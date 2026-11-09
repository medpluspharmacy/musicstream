import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Library, Music, Video, Trash2, Pencil, ListPlus, Play, X } from "lucide-react";
import { listMedia, uploadMedia, renameMedia, deleteMedia, addToPlaylist, errorMessage, type MediaFile } from "@/lib";
import { formatBytes, formatDuration } from "@/lib/format";
import { resolveApiUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button, Card, EmptyState, Input, Label, PageHeader } from "@/components/shared";
import { Progress } from "@/components/ui/progress";

/** Reads duration in the browser; also proves the file is playable before it's uploaded. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
    const url = URL.createObjectURL(file);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (Number.isFinite(el.duration) && el.duration > 0) resolve(el.duration);
      else reject(new Error("Couldn't read this file's length. Try exporting it as MP3 or MP4."));
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file can't be played in a browser, so listeners couldn't hear it. Try MP3, AAC or MP4."));
    };
    el.src = url;
  });
}

const MAX_FILES = 5;

interface PickedFile {
  id: number;
  file: File;
  title: string;
  /** 0–1 while uploading; null before or after. */
  progress: number | null;
  error: string | null;
}

let nextPickId = 1;
const titleFor = (f: File) => f.name.replace(/\.[^.]+$/, "");

function UploadCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const update = (id: number, change: Partial<PickedFile>) =>
    setPicked(list => list.map(p => (p.id === id ? { ...p, ...change } : p)));

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_FILES - picked.length;
    setNotice(chosen.length > room ? `You can upload ${MAX_FILES} files at a time, so only the first ${Math.max(room, 0)} were added.` : null);
    const added = chosen.slice(0, Math.max(room, 0)).map(file => ({ id: nextPickId++, file, title: titleFor(file), progress: null, error: null }));
    setPicked(list => [...list, ...added]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (picked.length === 0) return;
    if (picked.some(p => !p.title.trim())) { setNotice("Give every file a title."); return; }
    setNotice(null);
    setUploading(true);
    let done = 0;
    // One at a time keeps each upload fast and the server's temp space small.
    for (const p of picked) {
      update(p.id, { error: null, progress: 0 });
      try {
        const durationSeconds = await readDuration(p.file);
        await uploadMedia({ file: p.file, title: p.title.trim(), durationSeconds }, progress => update(p.id, { progress }));
        done++;
        setPicked(list => list.filter(x => x.id !== p.id));
        qc.invalidateQueries({ queryKey: ["media"] });
      } catch (err) {
        update(p.id, { progress: null, error: err instanceof Error ? err.message : "Upload failed" });
      }
    }
    setUploading(false);
    const failed = picked.length - done;
    if (done > 0) {
      toast({
        title: done === 1 ? "1 file uploaded" : `${done} files uploaded`,
        description: failed ? `${failed} didn't upload. See the reasons below.` : "They're in the library.",
        variant: failed ? "destructive" : undefined,
      });
    }
  }

  const full = picked.length >= MAX_FILES;

  return (
    <Card className="p-5 mb-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label>Audio or video files <span className="font-normal text-muted-foreground">(up to {MAX_FILES} at a time)</span></Label>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,video/*"
            multiple
            onChange={onPick}
            disabled={uploading || full}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-muted/70 disabled:opacity-50"
          />
        </div>

        {picked.length > 0 && (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {picked.map(p => (
              <li key={p.id} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {p.file.type.startsWith("video/")
                    ? <Video className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <Music className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <Input
                    aria-label={`Title for ${p.file.name}`}
                    value={p.title}
                    onChange={e => update(p.id, { title: e.target.value })}
                    disabled={uploading}
                    required
                  />
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-16 text-right">{formatBytes(p.file.size)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${p.file.name}`}
                    disabled={uploading}
                    onClick={() => setPicked(list => list.filter(x => x.id !== p.id))}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground truncate pl-6">{p.file.name}</p>
                {p.progress !== null && (
                  <div className="flex items-center gap-3 pl-6">
                    <Progress value={p.progress * 100} className="flex-1" />
                    <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{Math.round(p.progress * 100)}%</span>
                  </div>
                )}
                {p.error && <p className="text-sm text-destructive pl-6">{p.error}</p>}
              </li>
            ))}
          </ul>
        )}

        {notice && <p className="text-sm text-amber-700 dark:text-amber-400">{notice}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={picked.length === 0} isLoading={uploading}>
            {picked.length > 1 ? `Upload ${picked.length} files` : "Upload"}
          </Button>
          {picked.length > 0 && !uploading && (
            <Button type="button" variant="ghost" onClick={() => { setPicked([]); setNotice(null); }}>Clear</Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function MediaRow({ m }: { m: MediaFile }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [previewing, setPreviewing] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["media"] });
    qc.invalidateQueries({ queryKey: ["playlist"] });
  };
  const onError = (title: string) => (err: unknown) => toast({ title, description: errorMessage(err), variant: "destructive" });

  const rename = useMutation({ mutationFn: (t: string) => renameMedia(m.id, t), onSuccess: refresh, onError: onError("Couldn't rename") });
  const remove = useMutation({ mutationFn: () => deleteMedia(m.id), onSuccess: refresh, onError: onError("Couldn't delete") });
  const add = useMutation({
    mutationFn: () => addToPlaylist(m.id),
    onSuccess: () => { refresh(); toast({ title: "Added to playlist", description: m.title }); },
    onError: onError("Couldn't add to playlist"),
  });
  const Icon = m.kind === "video" ? Video : Music;

  return (
    <li className="px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{m.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDuration(m.durationSeconds)} · {formatBytes(m.sizeBytes)}
            {m.inPlaylist && <span className="ml-2 text-primary font-medium">In playlist</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" aria-label={previewing ? "Close preview" : "Preview"} onClick={() => setPreviewing(p => !p)}>
            {previewing ? <X className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" aria-label="Rename" onClick={() => {
            const t = prompt("New title", m.title);
            if (t?.trim() && t.trim() !== m.title) rename.mutate(t.trim());
          }}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Add to playlist" onClick={() => add.mutate()} isLoading={add.isPending}>
            <ListPlus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Delete" onClick={() => {
            const warn = m.inPlaylist ? " It will also be removed from the playlist." : "";
            if (confirm(`Delete "${m.title}"?${warn}`)) remove.mutate();
          }}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>
      {previewing && (
        <video
          src={resolveApiUrl(m.streamUrl)}
          controls
          autoPlay
          className={`mt-3 w-full rounded-xl bg-black ${m.kind === "audio" ? "h-12" : "max-h-80"}`}
        />
      )}
    </li>
  );
}

export default function Media() {
  const { data: media = [], isLoading } = useQuery({ queryKey: ["media"], queryFn: listMedia });

  return (
    <div>
      <PageHeader title="Media Library" description="Upload audio and video ads, jingles and tracks for the station." />
      <UploadCard />
      {!isLoading && media.length === 0 ? (
        <EmptyState icon={Library} title="No media yet" description="Upload your first audio or video file above." />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {media.map(m => <MediaRow key={m.id} m={m} />)}
          </ul>
        </Card>
      )}
    </div>
  );
}
