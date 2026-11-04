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

function UploadCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
    if (f) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    try {
      const durationSeconds = await readDuration(file);
      setProgress(0);
      const media = await uploadMedia({ file, title, durationSeconds }, setProgress);
      toast({ title: "Uploaded", description: `${media.title} is in the library.` });
      setFile(null);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["media"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  }

  return (
    <Card className="p-5 mb-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Audio or video file</Label>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*,video/*"
              onChange={onPick}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-muted/70"
              required
            />
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Summer sale ad" required />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {progress !== null && (
          <div className="flex items-center gap-3">
            <Progress value={progress * 100} className="flex-1" />
            <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{Math.round(progress * 100)}%</span>
          </div>
        )}
        <Button type="submit" disabled={!file} isLoading={progress !== null}>Upload</Button>
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
