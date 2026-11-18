import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Radio, Square } from "lucide-react";
import {
  getStationStatus, startStation, stopStation, getNowPlaying, setStationSource, setPlayback, errorMessage, type PlaybackSettings, type StationSource,
} from "@/lib";
import { useToast } from "@/hooks/use-toast";
import { Button, Card, PageHeader } from "@/components/shared";
import { Slider } from "@/components/ui/slider";
import { ScheduleCard } from "@/components/schedule-editor";
import { PlaylistsCard } from "@/components/playlist-editor";
import { Switch } from "@/components/ui/switch";

const CROSSFADE_SAVE_DELAY_MS = 400;

function PlaybackCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: status } = useQuery({ queryKey: ["station"], queryFn: getStationStatus });
  const saved = status?.playback;
  // The slider moves freely and saves once it settles, so several arrow-key
  // presses become one save instead of each being lost to the one before.
  const [crossfade, setCrossfade] = useState(saved?.crossfadeSeconds ?? 0);
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => { if (saved && pending === null) setCrossfade(saved.crossfadeSeconds); }, [saved?.crossfadeSeconds]);
  const save = useMutation({
    mutationFn: setPlayback,
    onSuccess: (res) => {
      qc.setQueryData(["station"], res);
      qc.invalidateQueries({ queryKey: ["now-playing"] });
    },
    onError: (err) => {
      if (saved) setCrossfade(saved.crossfadeSeconds);
      toast({ title: "Couldn't save playback settings", description: errorMessage(err), variant: "destructive" });
    },
  });
  useEffect(() => {
    if (pending === null || !saved) return;
    const timer = setTimeout(() => {
      setPending(null);
      if (pending !== saved.crossfadeSeconds) save.mutate({ ...saved, crossfadeSeconds: pending });
    }, CROSSFADE_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pending]);
  if (!saved) return null;
  const update = (change: Partial<PlaybackSettings>) => save.mutate({ ...saved, crossfadeSeconds: crossfade, ...change });

  return (
    <Card className="p-6 mb-6">
      <p className="font-semibold text-lg">Playback</p>
      <p className="text-sm text-muted-foreground mt-1">
        How the playlist plays for every listener. AzuraCast stations use their own settings.
      </p>
      <div className="mt-5 divide-y divide-border">
        <div className="pb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="sm:w-48 shrink-0">
            <p className="font-medium">Crossfade</p>
            <p className="text-xs text-muted-foreground">Overlap the end of each item with the next</p>
          </div>
          <div className="flex items-center gap-4 flex-1">
            <Slider
              value={[crossfade]}
              min={0}
              max={12}
              step={1}
              aria-label="Crossfade seconds"
              onValueChange={([v]) => setCrossfade(v)}
              onValueCommit={([v]) => setPending(v)}
            />
            <span className="w-14 text-sm tabular-nums text-right">{crossfade === 0 ? "Off" : `${crossfade} sec`}</span>
          </div>
        </div>
        <div className="pt-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Gapless</p>
            <p className="text-xs text-muted-foreground">Load the next item early so there's no silence between items</p>
          </div>
          <Switch
            checked={saved.gapless}
            disabled={save.isPending}
            aria-label="Gapless playback"
            onCheckedChange={(gapless) => update({ gapless })}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        Short items like jingles fade for at most half their length. iPhones and iPads switch items with a clean cut instead of a fade.
      </p>
    </Card>
  );
}

function StationCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: status } = useQuery({ queryKey: ["station"], queryFn: getStationStatus });
  const { data: now } = useQuery({ queryKey: ["now-playing"], queryFn: () => getNowPlaying(), refetchInterval: 5_000 });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["station"] });
    qc.invalidateQueries({ queryKey: ["now-playing"] });
  };
  const toggle = useMutation({
    mutationFn: () => (status?.live ? stopStation() : startStation()),
    onSuccess: refresh,
    onError: (err) => toast({ title: "Couldn't change station", description: errorMessage(err), variant: "destructive" }),
  });
  const switchSource = useMutation({
    mutationFn: setStationSource,
    onSuccess: refresh,
    onError: (err) => toast({ title: "Couldn't switch source", description: errorMessage(err), variant: "destructive" }),
  });
  const onAzuraCast = status?.source === "azuracast";
  const nowTitle = now?.stream ? `${now.stream.artist ? `${now.stream.artist} – ` : ""}${now.stream.title}` : now?.current?.title;

  function pickSource(source: StationSource) {
    if (source === status?.source) return;
    if (status?.live && !confirm("Switch what everyone is hearing right now?")) return;
    switchSource.mutate(source);
  }

  return (
    <Card className="p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${status?.live ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            <Radio className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-lg flex items-center gap-2">
              {status?.live ? "Live" : "Off air"}
              {status?.live && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {status?.live && nowTitle
                ? `Now playing: ${nowTitle}`
                : onAzuraCast
                  ? "Listeners hear your AzuraCast station while the station is live."
                  : status?.today.playlists.length
                    ? `Today: ${status.today.playlists.map(p => p.name).join(" → ")}, on a loop.`
                    : "Nothing is scheduled for today. Add a playlist to today's queue below."}
            </p>
          </div>
        </div>
        <Button
          variant={status?.live ? "destructive" : "primary"}
          onClick={() => {
            if (status?.live && !confirm("Stop the station? Everyone listening will hear silence.")) return;
            toggle.mutate();
          }}
          isLoading={toggle.isPending}
          className="shrink-0"
        >
          {status?.live ? <><Square className="w-4 h-4 mr-2" /> Stop station</> : <><Play className="w-4 h-4 mr-2" /> Go live</>}
        </Button>
      </div>

      <div className="mt-5 pt-5 border-t border-border flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm font-medium text-muted-foreground shrink-0">Station plays</p>
        <div className="inline-flex rounded-xl border border-border p-1 bg-muted/40">
          {([["playlist", "Schedule"], ["azuracast", status?.azuracastStation ? `AzuraCast · ${status.azuracastStation}` : "AzuraCast"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={switchSource.isPending || (value === "azuracast" && !status?.azuracastStation)}
              onClick={() => pickSource(value)}
              aria-pressed={status?.source === value}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                status?.source === value ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {!status?.azuracastStation && (
          <p className="text-xs text-muted-foreground">
            <Link href="/integrations" className="text-primary hover:underline">Connect AzuraCast</Link> to stream a radio station instead.
          </p>
        )}
      </div>
    </Card>
  );
}

export default function Playlists() {
  return (
    <div>
      <PageHeader title="Playlists" description="Build playlists, then schedule which ones play each day of the week." />
      <StationCard />
      <PlaybackCard />
      <ScheduleCard />
      <PlaylistsCard />
    </div>
  );
}
