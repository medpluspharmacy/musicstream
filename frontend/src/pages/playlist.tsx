import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ListMusic, Music, Play, Radio, Square, Trash2, Video } from "lucide-react";
import {
  listPlaylist, listMedia, addToPlaylist, removeFromPlaylist, reorderPlaylist,
  getStationStatus, startStation, stopStation, getNowPlaying, setStationSource, errorMessage,
  type StationSource,
} from "@/lib";
import { formatDuration } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Button, Card, EmptyState, PageHeader } from "@/components/shared";

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
                  : "Listeners hear the playlist on a continuous loop while the station is live."}
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
          {([["playlist", "This playlist"], ["azuracast", status?.azuracastStation ? `AzuraCast · ${status.azuracastStation}` : "AzuraCast"]] as const).map(([value, label]) => (
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

export default function Playlist() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState("");
  const { data: items = [], isLoading } = useQuery({ queryKey: ["playlist"], queryFn: listPlaylist });
  const { data: media = [] } = useQuery({ queryKey: ["media"], queryFn: listMedia });

  const refresh = () => ["playlist", "media", "station", "now-playing"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  const onError = (title: string) => (err: unknown) => toast({ title, description: errorMessage(err), variant: "destructive" });
  const add = useMutation({
    mutationFn: (mediaId: number) => addToPlaylist(mediaId),
    onSuccess: () => { setSelected(""); refresh(); },
    onError: onError("Couldn't add to playlist"),
  });
  const remove = useMutation({ mutationFn: removeFromPlaylist, onSuccess: refresh, onError: onError("Couldn't remove item") });
  const reorder = useMutation({
    mutationFn: reorderPlaylist,
    onSuccess: (updated) => { qc.setQueryData(["playlist"], updated); refresh(); },
    onError: onError("Couldn't reorder"),
  });

  function move(index: number, delta: number) {
    const ids = items.map(i => i.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  }

  const total = items.reduce((sum, i) => sum + i.media.durationSeconds, 0);

  return (
    <div>
      <PageHeader title="Playlist" description="The universal playlist every listener hears, in this order." />
      <StationCard />

      <Card className="p-5 mb-6">
        {media.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Your media library is empty. <Link href="/media" className="text-primary font-medium hover:underline">Upload media</Link> to build the playlist.
          </p>
        ) : (
          <form
            className="flex flex-col sm:flex-row gap-3"
            onSubmit={e => { e.preventDefault(); if (selected) add.mutate(Number(selected)); }}
          >
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20"
              required
            >
              <option value="">Choose from the media library…</option>
              {media.map(m => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.kind}, {formatDuration(m.durationSeconds)}){m.inPlaylist ? " · already in playlist" : ""}
                </option>
              ))}
            </select>
            <Button type="submit" isLoading={add.isPending} className="shrink-0">Add to playlist</Button>
          </form>
        )}
      </Card>

      {!isLoading && items.length === 0 ? (
        <EmptyState icon={ListMusic} title="The playlist is empty" description="Add media above, then go live." />
      ) : (
        <Card>
          <div className="px-5 py-3 border-b border-border text-sm text-muted-foreground">
            {items.length} items · {formatDuration(total)} per loop
          </div>
          <ol className="divide-y divide-border">
            {items.map((item, index) => {
              const Icon = item.media.kind === "video" ? Video : Music;
              return (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-6 text-sm tabular-nums text-muted-foreground text-right">{index + 1}</span>
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <p className="flex-1 min-w-0 truncate font-medium">{item.media.title}</p>
                  <span className="text-sm tabular-nums text-muted-foreground">{formatDuration(item.media.durationSeconds)}</span>
                  <div className="flex items-center shrink-0">
                    <Button variant="ghost" size="sm" aria-label="Move up" disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label="Move down" disabled={index === items.length - 1 || reorder.isPending} onClick={() => move(index, 1)}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label="Remove from playlist" onClick={() => remove.mutate(item.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}
