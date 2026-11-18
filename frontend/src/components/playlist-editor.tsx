import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ListMusic, Music, Pencil, Plus, Trash2, Video } from "lucide-react";
import {
  listPlaylists, createPlaylist, renamePlaylist, deletePlaylist, listPlaylistItems, addToPlaylistById,
  reorderPlaylistItems, removePlaylistItem, listMedia, errorMessage, type PlaylistSummary,
} from "@/lib";
import { formatDuration } from "@/lib/format";
import { shortDay } from "@/lib/days";
import { useToast } from "@/hooks/use-toast";
import { Button, Card, EmptyState, Input, LoadError } from "@/components/shared";

const countItems = (n: number) => (n === 1 ? "1 item" : `${n} items`);
const SELECT = "flex-1 px-4 py-2.5 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20";

/** All playlists, and the items of the one selected. */
export function PlaylistsCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: playlists = [], isError, error, refetch } = useQuery({ queryKey: ["playlists"], queryFn: listPlaylists });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  useEffect(() => {
    if (playlists.length && !playlists.some(p => p.id === selectedId)) setSelectedId(playlists[0].id);
  }, [playlists, selectedId]);

  const refresh = () => ["playlists", "playlist-items", "schedule", "station", "now-playing", "media", "dashboard-summary"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  const onError = (title: string) => (err: unknown) => toast({ title, description: errorMessage(err), variant: "destructive" });
  const create = useMutation({
    mutationFn: createPlaylist,
    onSuccess: (p) => {
      // Add it to the list now, so it stays selected while the list reloads.
      qc.setQueryData<PlaylistSummary[]>(["playlists"], old => (old ? [...old, p] : [p]));
      setNewName(""); setSelectedId(p.id); refresh(); toast({ title: "Playlist created", description: `Add it to a day in the schedule above to play it.` }); },
    onError: onError("Couldn't create the playlist"),
  });
  const rename = useMutation({ mutationFn: ({ id, name }: { id: number; name: string }) => renamePlaylist(id, name), onSuccess: refresh, onError: onError("Couldn't rename") });
  const remove = useMutation({ mutationFn: deletePlaylist, onSuccess: () => { setSelectedId(null); refresh(); }, onError: onError("Couldn't delete") });

  if (isError) return <LoadError what="the playlists" error={error} onRetry={() => refetch()} />;
  const selected = playlists.find(p => p.id === selectedId);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (newName.trim()) create.mutate(newName.trim());
  }

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="p-6 pb-4 flex items-center gap-3">
        <ListMusic className="w-5 h-5 text-primary" />
        <div>
          <p className="font-semibold text-lg">Playlists</p>
          <p className="text-sm text-muted-foreground">Build as many as you like, then queue them on days in the schedule.</p>
        </div>
      </div>
      <div className="grid md:grid-cols-[16rem_1fr] border-t border-border">
        <div className="border-b md:border-b-0 md:border-r border-border p-3 space-y-1">
          {playlists.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              aria-current={p.id === selectedId}
              className={`w-full text-left rounded-xl px-3 py-2 transition-colors ${p.id === selectedId ? "bg-primary/10 text-foreground" : "hover:bg-muted"}`}
            >
              <p className="font-medium truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {countItems(p.itemCount)} · {formatDuration(p.totalDurationSeconds)}
                {p.scheduledDays.length > 0 && <> · {p.scheduledDays.map(shortDay).join(", ")}</>}
              </p>
            </button>
          ))}
          <form onSubmit={onCreate} className="pt-2 flex gap-2">
            <Input placeholder="New playlist name" aria-label="New playlist name" value={newName} maxLength={80} onChange={e => setNewName(e.target.value)} />
            <Button type="submit" size="sm" aria-label="Create playlist" isLoading={create.isPending} disabled={!newName.trim()}><Plus className="w-4 h-4" /></Button>
          </form>
        </div>
        <div className="p-5 min-w-0">
          {selected ? (
            <PlaylistItems
              playlist={selected}
              canDelete={playlists.length > 1}
              onRename={name => rename.mutate({ id: selected.id, name })}
              onDelete={() => {
                const where = selected.scheduledDays.length ? ` It's queued on ${selected.scheduledDays.map(shortDay).join(", ")} and will be removed from those days.` : "";
                if (confirm(`Delete "${selected.name}"?${where}`)) remove.mutate(selected.id);
              }}
              onChanged={refresh}
            />
          ) : <p className="text-sm text-muted-foreground">Choose a playlist.</p>}
        </div>
      </div>
    </Card>
  );
}

function PlaylistItems({ playlist, canDelete, onRename, onDelete, onChanged }: {
  playlist: { id: number; name: string };
  canDelete: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState("");
  const { data: items = [], isLoading, isError, error, refetch } = useQuery({ queryKey: ["playlist-items", playlist.id], queryFn: () => listPlaylistItems(playlist.id) });
  const { data: media = [] } = useQuery({ queryKey: ["media"], queryFn: listMedia });
  const onError = (title: string) => (err: unknown) => toast({ title, description: errorMessage(err), variant: "destructive" });
  const add = useMutation({ mutationFn: (mediaId: number) => addToPlaylistById(playlist.id, mediaId), onSuccess: () => { setSelected(""); onChanged(); }, onError: onError("Couldn't add") });
  const remove = useMutation({ mutationFn: (itemId: number) => removePlaylistItem(playlist.id, itemId), onSuccess: onChanged, onError: onError("Couldn't remove") });
  const reorder = useMutation({
    mutationFn: (ids: number[]) => reorderPlaylistItems(playlist.id, ids),
    onSuccess: (updated) => { qc.setQueryData(["playlist-items", playlist.id], updated); onChanged(); },
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
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold truncate">{playlist.name}</h2>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="sm" aria-label="Rename playlist" onClick={() => {
            const n = prompt("Playlist name", playlist.name);
            if (n?.trim() && n.trim() !== playlist.name) onRename(n.trim());
          }}><Pencil className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" aria-label="Delete playlist" disabled={!canDelete} title={canDelete ? undefined : "Keep at least one playlist"} onClick={onDelete}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      {media.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-4">
          Your media library is empty. <Link href="/media" className="text-primary font-medium hover:underline">Upload media</Link> to build playlists.
        </p>
      ) : (
        <form className="flex flex-col sm:flex-row gap-3 mb-4" onSubmit={e => { e.preventDefault(); if (selected) add.mutate(Number(selected)); }}>
          <select value={selected} onChange={e => setSelected(e.target.value)} className={SELECT} aria-label={`Media to add to ${playlist.name}`} required>
            <option value="">Choose from the media library…</option>
            {media.map(m => <option key={m.id} value={m.id}>{m.title} ({m.kind}, {formatDuration(m.durationSeconds)})</option>)}
          </select>
          <Button type="submit" isLoading={add.isPending} className="shrink-0">Add to playlist</Button>
        </form>
      )}

      {isError ? (
        <LoadError what="this playlist" error={error} onRetry={() => refetch()} />
      ) : !isLoading && items.length === 0 ? (
        <EmptyState icon={ListMusic} title="This playlist is empty" description="Add media above." />
      ) : (
        <div className="rounded-xl border border-border">
          <div className="px-4 py-2.5 border-b border-border text-sm text-muted-foreground">{countItems(items.length)} · {formatDuration(total)}</div>
          <ol className="divide-y divide-border">
            {items.map((item, index) => {
              const Icon = item.media.kind === "video" ? Video : Music;
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-6 text-sm tabular-nums text-muted-foreground text-right">{index + 1}</span>
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <p className="flex-1 min-w-0 truncate font-medium">{item.media.title}</p>
                  <span className="text-sm tabular-nums text-muted-foreground">{formatDuration(item.media.durationSeconds)}</span>
                  <div className="flex items-center shrink-0">
                    <Button variant="ghost" size="sm" aria-label="Move up" disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)}><ArrowUp className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" aria-label="Move down" disabled={index === items.length - 1 || reorder.isPending} onClick={() => move(index, 1)}><ArrowDown className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" aria-label={`Remove ${item.media.title}`} onClick={() => remove.mutate(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
