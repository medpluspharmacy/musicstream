import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Headphones, Music, Radio, Video, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getNowPlaying, type MediaKind, type NowPlaying } from "@/lib";
import { formatDuration } from "@/lib/format";
import { resolveApiUrl } from "@/lib/utils";
import { Button, Card, PageHeader } from "@/components/shared";
import { Slider } from "@/components/ui/slider";

// Re-seek when the local player is this far from the station's position.
const DRIFT_SECONDS = 3;
const VOLUME_KEY = "musicstream.volume";
// Start loading the next item this long before it's due.
const PRELOAD_LEAD_MS = 30_000;
const FADE_STEP_MS = 50;
const HANDOFF_REFETCH_MS = 1_500;
const HANDOFF_GRACE_MS = 4_000;

// iOS and iPadOS ignore volume changes from pages, so crossfades become clean cuts there.
const CAN_FADE = (() => {
  try {
    const probe = document.createElement("audio");
    probe.volume = 0.5;
    return probe.volume === 0.5;
  } catch {
    return false;
  }
})();

interface Deck {
  /** The playlist item loaded, "live" for the AzuraCast stream, or null. */
  key: number | "live" | null;
  kind: MediaKind;
  /** Fade level from 0 to 1, multiplied by the listener's volume. */
  gain: number;
  fade: number | null;
  ready: boolean;
}

const emptyDeck = (): Deck => ({ key: null, kind: "audio", gain: 1, fade: null, ready: false });

function readVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(v) && v >= 0 && v <= 1 && localStorage.getItem(VOLUME_KEY) !== null ? v : 0.8;
  } catch {
    return 0.8;
  }
}

export default function Listen() {
  const { user, refreshUser } = useAuth();
  // New sign-ups can't listen until an admin approves them; the server enforces this too.
  const waiting = user?.role === "user" && user.approvalStatus !== "approved";
  // Read by each poll, so tuning in doesn't restart the query.
  const tunedInRef = useRef(false);
  const { data, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["now-playing"],
    queryFn: () => getNowPlaying(tunedInRef.current),
    enabled: !waiting,
    // Live streams change track on their own schedule, so check a little more often.
    refetchInterval: q => (q.state.data?.stream ? 10_000 : 15_000),
  });
  const [tunedIn, setTunedIn] = useState(false);
  tunedInRef.current = tunedIn;
  const [blocked, setBlocked] = useState(false);
  const [volume, setVolume] = useState(readVolume);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0);
  // Two players ("decks"): the active one plays the current item, the spare loads
  // the next item early so it can start exactly on time, fading in over a crossfade.
  const deckRefs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const decksRef = useRef<Deck[]>([emptyDeck(), emptyDeck()]);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const timersRef = useRef<number[]>([]);
  // The last timed handoff, so a poll that lands a moment early doesn't undo it.
  const handoffRef = useRef<{ itemId: number; at: number } | null>(null);
  const volumeRef = useRef({ volume, muted });
  volumeRef.current = { volume, muted };
  const [, setTick] = useState(0);

  const current = data?.current ?? null;
  const next = data?.next ?? null;
  const stream = data?.stream ?? null;
  const loadKey = stream ? "live" : current?.itemId ?? null;

  // Re-render every second so the live stream's elapsed time keeps moving between polls.
  useEffect(() => {
    if (!stream) return;
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, [!!stream]);

  function el(i: number) {
    return deckRefs[i].current;
  }

  function applyVolume(i: number) {
    const e = el(i);
    if (!e) return;
    const { volume: v, muted: m } = volumeRef.current;
    e.volume = CAN_FADE ? v * decksRef.current[i].gain : v;
    e.muted = m;
  }

  function stopFade(i: number) {
    const d = decksRef.current[i];
    if (d.fade !== null) { clearInterval(d.fade); d.fade = null; }
  }

  /** Moves a deck's volume to `to` over `seconds`, then runs `done`. */
  function fade(i: number, to: number, seconds: number, done?: () => void) {
    stopFade(i);
    const d = decksRef.current[i];
    if (!CAN_FADE || seconds <= 0) { d.gain = to; applyVolume(i); done?.(); return; }
    const from = d.gain;
    const started = Date.now();
    d.fade = window.setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / (seconds * 1000));
      d.gain = from + (to - from) * t;
      applyVolume(i);
      if (t >= 1) { stopFade(i); done?.(); }
    }, FADE_STEP_MS);
  }

  function unload(i: number) {
    const e = el(i);
    stopFade(i);
    decksRef.current[i] = emptyDeck();
    if (!e) return;
    e.pause();
    e.onloadedmetadata = null;
    e.removeAttribute("src");
    e.load();
  }

  const play = (i: number) => {
    const e = el(i);
    if (!e) return;
    e.play().then(() => setBlocked(false)).catch(() => { if (i === activeRef.current) setBlocked(true); });
  };

  /** Loads an item into a deck. With `at`, seeks there and plays; without, waits paused at the start. */
  function load(i: number, item: { itemId: number; kind: MediaKind; streamUrl: string }, at: (() => number) | null, gain = 1) {
    const e = el(i);
    if (!e) return;
    stopFade(i);
    decksRef.current[i] = { key: item.itemId, kind: item.kind, gain, fade: null, ready: false };
    applyVolume(i);
    e.src = resolveApiUrl(item.streamUrl);
    e.onloadedmetadata = () => {
      decksRef.current[i].ready = true;
      if (at) {
        e.currentTime = Math.min(at(), Math.max(e.duration - 0.25, 0));
        play(i);
      }
    };
  }

  function makeActive(i: number) {
    activeRef.current = i;
    setActive(i);
  }

  /** Starts the next item on the spare deck at its scheduled time, crossfading if set. */
  function handOff(item: NonNullable<NowPlaying["next"]>, fadeSeconds: number, scheduledAt: number) {
    const from = activeRef.current;
    const to = 1 - from;
    const late = () => Math.max(0, (Date.now() - scheduledAt) / 1000);
    const crossfade = CAN_FADE && fadeSeconds > 0;
    const spare = decksRef.current[to];
    if (spare.key === item.itemId && spare.ready) {
      const e = el(to)!;
      spare.gain = crossfade ? 0 : 1;
      applyVolume(to);
      e.currentTime = late();
      play(to);
    } else {
      load(to, item, late, crossfade ? 0 : 1);
    }
    if (crossfade) fade(to, 1, fadeSeconds);
    makeActive(to);
    handoffRef.current = { itemId: item.itemId, at: Date.now() };
    // The outgoing item plays out its last seconds under the new one, or stops at once.
    if (crossfade) fade(from, 0, fadeSeconds, () => unload(from));
    else unload(from);
    // Fetch the new schedule once the station has moved on.
    timersRef.current.push(window.setTimeout(() => refetch(), HANDOFF_REFETCH_MS));
  }

  // Keep the local player locked to the station: the playlist by its clock, the live stream as-is.
  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const a = activeRef.current;
    const spare = 1 - a;
    if (loadKey === null) { unload(0); unload(1); return; }
    // A paused live stream would resume from stale buffer, so drop it and reconnect on tune-in.
    if (!tunedIn) {
      if (stream) unload(a); else el(a)?.pause();
      unload(spare);
      return;
    }

    if (stream) {
      unload(spare);
      if (decksRef.current[a].key !== "live") {
        decksRef.current[a] = { key: "live", kind: "audio", gain: 1, fade: null, ready: false };
        const e = el(a)!;
        e.onloadedmetadata = null;
        applyVolume(a);
        e.src = resolveApiUrl(stream.streamUrl);
        play(a);
      } else if (el(a)?.paused) {
        play(a);
      }
      return;
    }
    if (!current) return;

    const expected = () => current.offsetSeconds + (Date.now() - dataUpdatedAt) / 1000;
    // Gain for joining partway through a crossfade.
    const joinGain = () => (CAN_FADE && current.fadeInSeconds > 0 ? Math.min(1, expected() / current.fadeInSeconds) : 1);

    const recent = handoffRef.current;
    const justHandedOff = recent && Date.now() - recent.at < HANDOFF_GRACE_MS;
    if (justHandedOff && recent.itemId !== current.itemId && current.nextStartsInSeconds < HANDOFF_GRACE_MS / 1000) {
      // This poll was answered just before the station moved on; the handoff is already right.
    } else if (decksRef.current[a].key === current.itemId) {
      // Same item: the station may have looped back to it, or we drifted.
      const e = el(a)!;
      if (decksRef.current[a].ready && (e.ended || Math.abs(e.currentTime - expected()) > DRIFT_SECONDS)) {
        e.currentTime = Math.min(expected(), Math.max(e.duration - 0.25, 0));
      }
      if (e.paused) play(a);
    } else if (decksRef.current[spare].key === current.itemId && decksRef.current[spare].ready) {
      // The handoff was missed (e.g. a sleeping tab): start the preloaded item where the station is.
      const e = el(spare)!;
      decksRef.current[spare].gain = joinGain();
      applyVolume(spare);
      e.currentTime = Math.min(expected(), Math.max(e.duration - 0.25, 0));
      play(spare);
      if (decksRef.current[spare].gain < 1) fade(spare, 1, current.fadeInSeconds - expected());
      makeActive(spare);
      unload(a);
    } else {
      unload(spare);
      load(a, current, expected, joinGain());
      if (joinGain() < 1) fade(a, 1, Math.max(0, current.fadeInSeconds - expected()));
    }

    // Load the next item early and start it on time. Without this, the next item
    // loads after the current one ends, leaving a short gap.
    const early = data!.gapless || current.fadeOutSeconds > 0;
    if (!early || !next || next.itemId === current.itemId) return;
    const startsAt = dataUpdatedAt + current.nextStartsInSeconds * 1000;
    const prepare = () => {
      const s = 1 - activeRef.current;
      if (decksRef.current[s].key !== next.itemId) load(s, next, null);
    };
    const prepareIn = startsAt - PRELOAD_LEAD_MS - Date.now();
    if (prepareIn <= 0) prepare();
    else timersRef.current.push(window.setTimeout(prepare, prepareIn));
    timersRef.current.push(window.setTimeout(() => {
      if (decksRef.current[activeRef.current].key === current.itemId) handOff(next, current.fadeOutSeconds, startsAt);
    }, Math.max(0, startsAt - Date.now())));
  }, [tunedIn, loadKey, dataUpdatedAt]);

  // Stop everything when leaving the page.
  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout);
    [0, 1].forEach(stopFade);
  }, []);

  useEffect(() => {
    [0, 1].forEach(applyVolume);
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* storage unavailable */ }
  }, [volume, muted]);

  // Check often while waiting so the player appears soon after approval.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(refreshUser, 10_000);
    return () => clearInterval(timer);
  }, [waiting]);

  // Pick up the next item promptly when one finishes, rather than waiting for the poll.
  function onEnded(i: number) {
    if (i !== activeRef.current) { unload(i); return; }
    // A live stream only ends if the connection closed; reconnect with a fresh link.
    if (stream) decksRef.current[i] = emptyDeck();
    setTimeout(() => refetch(), 300);
  }

  // A failed load (e.g. the network dropped) re-fetches a fresh stream URL.
  function onError(i: number) {
    if (i !== activeRef.current) { unload(i); return; }
    if (!tunedIn || loadKey === null) return;
    decksRef.current[i] = emptyDeck();
    setTimeout(() => refetch(), 2_000);
  }

  const isVideo = current?.kind === "video";
  const KindIcon = isVideo ? Video : Music;
  const title = stream?.title ?? current?.title ?? "";
  const elapsed = stream
    ? stream.elapsedSeconds + (Date.now() - dataUpdatedAt) / 1000
    : position;
  const duration = stream ? stream.durationSeconds : current?.durationSeconds ?? 0;

  if (waiting) {
    return (
      <div>
        <PageHeader title="Listen" description="The live station. Everyone hears the same thing at the same time." />
        <Card className="p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          <p className="text-xl font-semibold">Waiting for approval</p>
          <p className="text-muted-foreground mt-1 max-w-md">
            Thanks for signing up, {user?.name}. An admin needs to approve your account before you can listen.
            This page will update by itself once you're approved.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Listen" description="The live station. Everyone hears the same thing at the same time." />

      <Card className="mb-6">
        {deckRefs.map((ref, i) => (
          <video
            key={i}
            ref={ref}
            playsInline
            preload="auto"
            onEnded={() => onEnded(i)}
            onError={() => onError(i)}
            onTimeUpdate={e => { if (i === active) setPosition(e.currentTarget.currentTime); }}
            className={i === active && isVideo && tunedIn ? "w-full aspect-video bg-black" : "hidden"}
          />
        ))}

        {!data ? (
          <div className="p-12 text-center text-muted-foreground">Connecting to the station…</div>
        ) : data.live && data.unavailable ? (
          <div className="p-12 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Radio className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold">Reconnecting to the station…</p>
            <p className="text-muted-foreground mt-1">The live stream isn't responding. We'll keep trying.</p>
          </div>
        ) : !data.live || (!current && !stream) ? (
          <div className="p-12 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Radio className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold">The station is off air</p>
            <p className="text-muted-foreground mt-1">Playback starts automatically when it goes live.</p>
          </div>
        ) : !tunedIn ? (
          <div className="p-12 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <Headphones className="w-10 h-10 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">On air now</p>
            <p className="text-xl font-semibold mt-1">{title}</p>
            {stream?.artist && <p className="text-muted-foreground">{stream.artist}</p>}
            <Button size="lg" className="mt-6" onClick={() => setTunedIn(true)}>
              <Radio className="w-5 h-5 mr-2" /> Tune in
            </Button>
          </div>
        ) : (
          <div className="p-6">
            {!isVideo && (
              <div className="aspect-[3/1] rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center mb-6 overflow-hidden">
                {stream?.artUrl ? (
                  <img src={resolveApiUrl(stream.artUrl)} alt="" className="h-full aspect-square object-cover shadow-lg" />
                ) : (
                  <Music className="w-16 h-16 text-primary-foreground/80" />
                )}
              </div>
            )}
            <div className="flex items-start justify-between gap-4 mt-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live
                  {stream && <span className="normal-case tracking-normal font-medium text-muted-foreground">· {stream.stationName}</span>}
                  {stream?.liveDj && (
                    <span className="normal-case tracking-normal rounded-full bg-red-500/10 text-red-600 px-2 py-0.5">DJ {stream.liveDj}</span>
                  )}
                </p>
                <p className="text-2xl font-bold mt-1 truncate flex items-center gap-2">
                  <KindIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                  {title}
                </p>
                {stream?.artist && <p className="text-muted-foreground truncate">{stream.artist}</p>}
              </div>
              <Button variant="outline" size="sm" onClick={() => setTunedIn(false)}>Stop</Button>
            </div>

            {duration > 0 && (
              <div className="mt-5">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-[width] duration-500"
                    style={{ width: `${Math.min(100, (elapsed / duration) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs tabular-nums text-muted-foreground mt-1.5">
                  <span>{formatDuration(Math.min(elapsed, duration))}</span>
                  <span>{formatDuration(duration)}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-4 max-w-xs">
              <button
                onClick={() => setMuted(m => !m)}
                aria-label={muted ? "Unmute" : "Mute"}
                className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <Slider
                value={[muted ? 0 : volume * 100]}
                max={100}
                step={1}
                aria-label="Volume"
                onValueChange={([v]) => { setVolume(v / 100); setMuted(false); }}
              />
            </div>

            {blocked && (
              <Button className="mt-4" onClick={() => play(activeRef.current)}>
                Tap to resume audio
              </Button>
            )}
          </div>
        )}
      </Card>

      {data?.live && data.upNext.length > 0 && (
        <Card>
          <p className="px-5 pt-4 pb-2 text-sm font-semibold text-muted-foreground">Up next</p>
          <ol className="divide-y divide-border">
            {data.upNext.map((item, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                {item.kind === "video" ? <Video className="w-4 h-4 text-muted-foreground" /> : <Music className="w-4 h-4 text-muted-foreground" />}
                <span className="flex-1 truncate">{item.title}</span>
                <span className="tabular-nums text-muted-foreground">{formatDuration(item.durationSeconds)}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
