import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDriveUpload, Music2, RadioTower } from "lucide-react";
import { getAzuraCast, saveAzuraCast, disconnectAzuraCast, errorMessage, type AzuraCastConnection } from "@/lib";
import { useToast } from "@/hooks/use-toast";
import { Button, Card, Input, Label, PageHeader, StatusBadge } from "@/components/shared";

const STATUS_COLORS = {
  connected: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "not connected": "bg-amber-100 text-amber-700 border-amber-200",
  planned: "bg-slate-100 text-slate-600 border-slate-200",
};

const INTEGRATIONS = [
  {
    name: "Uploaded media",
    icon: HardDriveUpload,
    status: "connected",
    description: "Audio and video files uploaded in the Media Library. These play for every listener.",
  },
  {
    name: "Spotify",
    icon: Music2,
    status: "planned",
    description:
      "Spotify only allows playback through its own player, signed in to each listener's own Spotify Premium account. " +
      "Spotify tracks can't be re-streamed to everyone like uploaded media, so this needs its own listener sign-in flow.",
  },
];

function AzuraCastForm({ conn, onDone }: { conn: AzuraCastConnection; onDone: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [baseUrl, setBaseUrl] = useState(conn.baseUrl ?? "");
  const [station, setStation] = useState(conn.station ?? "");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    // A blank key field keeps the saved key.
    mutationFn: () => saveAzuraCast({ baseUrl, station, apiKey: apiKey || (conn.hasApiKey ? undefined : "") }),
    onSuccess: (res) => {
      qc.setQueryData(["azuracast"], res);
      qc.invalidateQueries({ queryKey: ["station"] });
      const p = res.preview;
      toast({
        title: `Connected to ${p?.stationName ?? "AzuraCast"}`,
        description: p ? `Now playing: ${p.artist ? `${p.artist} – ` : ""}${p.title}` : undefined,
      });
      onDone();
    },
    onError: (err) => setError(errorMessage(err, "Couldn't connect to AzuraCast.")),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>AzuraCast address</Label>
          <Input type="url" placeholder="https://radio.example.com" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} required />
        </div>
        <div>
          <Label>Station short name</Label>
          <Input placeholder="e.g. company_radio" value={station} onChange={e => setStation(e.target.value)} required />
        </div>
      </div>
      <div>
        <Label>API key <span className="font-normal text-muted-foreground">(only for private stations)</span></Label>
        <Input
          type="password"
          autoComplete="off"
          placeholder={conn.hasApiKey ? "Leave blank to keep the saved key" : "Optional"}
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" isLoading={save.isPending}>Test and save</Button>
        {conn.connected && <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>}
      </div>
    </form>
  );
}

function AzuraCastCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: conn } = useQuery({ queryKey: ["azuracast"], queryFn: getAzuraCast });
  const [editing, setEditing] = useState(false);
  const disconnect = useMutation({
    mutationFn: disconnectAzuraCast,
    onSuccess: (res) => {
      qc.setQueryData(["azuracast"], res);
      ["station", "now-playing"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      toast({ title: "AzuraCast disconnected" });
    },
    onError: (err) => toast({ title: "Couldn't disconnect", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <Card className="p-5 md:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <RadioTower className="w-5 h-5" />
          </div>
          <p className="font-semibold">AzuraCast</p>
        </div>
        {conn && <StatusBadge status={conn.connected ? "connected" : "not connected"} colors={STATUS_COLORS} />}
      </div>
      <p className="text-sm text-muted-foreground mt-3">
        Play a 24/7 station from your AzuraCast server, including live DJ sets. Listeners hear it through MusicStream, so they
        still need an approved account and 2FA. To stop people bypassing that, keep the station non-public in AzuraCast.
      </p>

      {!conn ? null : conn.connected && !editing ? (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <div className="text-sm min-w-0">
            <p className="font-medium truncate">{conn.baseUrl}</p>
            <p className="text-muted-foreground">
              Station <span className="font-mono">{conn.station}</span> · {conn.hasApiKey ? "API key saved" : "no API key"}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
            <Button
              variant="ghost"
              size="sm"
              isLoading={disconnect.isPending}
              onClick={() => { if (confirm("Disconnect AzuraCast? If the station is playing it, it switches back to your playlist.")) disconnect.mutate(); }}
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <AzuraCastForm key={String(conn.connected)} conn={conn} onDone={() => setEditing(false)} />
      )}

      {conn?.connected && !editing && (
        <p className="text-sm mt-3">
          <Link href="/playlist" className="text-primary font-medium hover:underline">Switch the station to AzuraCast</Link>
          <span className="text-muted-foreground"> on the Playlist page.</span>
        </p>
      )}
    </Card>
  );
}

export default function Integrations() {
  return (
    <div>
      <PageHeader title="Integrations" description="Sources the station can play from." />
      <div className="grid gap-4 md:grid-cols-2">
        <AzuraCastCard />
        {INTEGRATIONS.map(i => (
          <Card key={i.name} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <i.icon className="w-5 h-5" />
                </div>
                <p className="font-semibold">{i.name}</p>
              </div>
              <StatusBadge status={i.status} colors={STATUS_COLORS} />
            </div>
            <p className="text-sm text-muted-foreground mt-3">{i.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
