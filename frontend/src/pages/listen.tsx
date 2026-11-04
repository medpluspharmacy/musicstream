import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Headphones, Music, Radio, Video, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getNowPlaying } from "@/lib";
import { formatDuration } from "@/lib/format";
import { resolveApiUrl } from "@/lib/utils";
import { Button, Card, PageHeader } from "@/components/shared";
import { Slider } from "@/components/ui/slider";

// Re-seek when the local player is this far from the station's position.
const DRIFT_SECONDS = 3;
const VOLUME_KEY = "musicstream.volume";

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
  const { data, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["now-playing"],
    queryFn: getNowPlaying,
    enabled: !waiting,
    // Live streams change track on their own schedule, so check a little more often.
    refetchInterval: q => (q.state.data?.stream ? 10_000 : 15_000),
  });
  const [tunedIn, setTunedIn] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [volume, setVolume] = useState(readVolume);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0);
  const mediaRef = useRef<HTMLVideoElement>(null);
  // The playlist item loaded in the player, or "live" for the AzuraCast stream.
  const loadedItemRef = useRef<number | "live" | null>(null);
  const [, setTick] = useState(0);

  const current = data?.current ?? null;
  const stream = data?.stream ?? null;
  const loadKey = stream ? "live" : current?.itemId ?? null;

  // Re-render every second so the live stream's elapsed time keeps moving between polls.
  useEffect(() => {
    if (!stream) return;
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, [!!stream]);

  // Keep the local player locked to the station: the playlist by its clock, the live stream as-is.
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const unload = () => {
      el.pause();
      loadedItemRef.current = null;
      el.onloadedmetadata = null;
      el.removeAttribute("src");
      el.load();
    };
    if (loadKey === null) { unload(); return; }
    // A paused live stream would resume from stale buffer, so drop it and reconnect on tune-in.
    if (!tunedIn) { if (stream) unload(); else el.pause(); return; }

    const play = () => el.play().then(() => setBlocked(false)).catch(() => setBlocked(true));

    if (stream) {
      if (loadedItemRef.current !== "live") {
        loadedItemRef.current = "live";
        el.onloadedmetadata = null;
        el.src = resolveApiUrl(stream.streamUrl);
        play();
      } else if (el.paused) {
        play();
      }
      return;
    }
    if (!current) return;

    const expected = () => current.offsetSeconds + (Date.now() - dataUpdatedAt) / 1000;

    if (loadedItemRef.current !== current.itemId) {
      loadedItemRef.current = current.itemId;
      el.src = resolveApiUrl(current.streamUrl);
      el.onloadedmetadata = () => {
        el.currentTime = Math.min(expected(), Math.max(el.duration - 0.25, 0));
        play();
      };
      return;
    }
    // Same item: the station may have looped back to it, or we drifted.
    if (el.ended || Math.abs(el.currentTime - expected()) > DRIFT_SECONDS) {
      el.currentTime = Math.min(expected(), Math.max(el.duration - 0.25, 0));
    }
    if (el.paused) play();
  }, [tunedIn, loadKey, dataUpdatedAt]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* storage unavailable */ }
  }, [volume, muted]);

  // Check often while waiting so the player appears soon after approval.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(refreshUser, 10_000);
    return () => clearInterval(timer);
  }, [waiting]);

  // Pick up the next item promptly when one finishes, rather than waiting for the poll.
  function onEnded() {
    // A live stream only ends if the connection closed; reconnect with a fresh link.
    if (stream) loadedItemRef.current = null;
    setTimeout(() => refetch(), 300);
  }

  // A failed load (e.g. the network dropped) re-fetches a fresh stream URL.
  function onError() {
    if (!tunedIn || loadKey === null) return;
    loadedItemRef.current = null;
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
        <video
          ref={mediaRef}
          playsInline
          onEnded={onEnded}
          onError={onError}
          onTimeUpdate={e => setPosition(e.currentTarget.currentTime)}
          className={isVideo && tunedIn ? "w-full aspect-video bg-black" : "hidden"}
        />

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
              <Button className="mt-4" onClick={() => mediaRef.current?.play().then(() => setBlocked(false)).catch(() => {})}>
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
