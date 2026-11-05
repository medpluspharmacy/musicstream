import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive } from "lucide-react";
import { getStorageSettings, saveStorageSettings, resetStorageSettings, errorMessage, type StorageSettings } from "@/lib";
import { useToast } from "@/hooks/use-toast";
import { Button, Card, Input, Label, PageHeader, PasswordInput } from "@/components/shared";

const SELECT_CLASS = "w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:border-primary focus:ring-primary/20 focus:outline-none focus:ring-4 transition-all duration-200 text-foreground";

function plural(n: number) {
  return n === 1 ? "1 file stays" : `${n} files stay`;
}

function StorageForm({ settings }: { settings: StorageSettings }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const saved = settings.source === "saved";
  const [providerId, setProviderId] = useState(settings.provider);
  const [location, setLocation] = useState(settings.location);
  const [endpoint, setEndpoint] = useState(settings.endpoint);
  const [bucket, setBucket] = useState(settings.bucket);
  const [prefix, setPrefix] = useState(settings.prefix);
  const [accessKeyId, setAccessKeyId] = useState(settings.accessKeyId ?? "");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [forcePathStyle, setForcePathStyle] = useState(saved ? settings.forcePathStyle : true);
  const [error, setError] = useState<string | null>(null);

  const provider = settings.providers.find(p => p.id === providerId) ?? settings.providers[0];
  const isCustom = provider.id === "custom";
  const isBucket = provider.driver === "s3";
  const address = provider.endpointTemplate?.replace("{location}", location.trim() || `{${provider.locationLabel?.toLowerCase()}}`);

  function onProviderChange(id: string) {
    setProviderId(id);
    setLocation("");
    setError(null);
  }

  function done(res: StorageSettings, title: string) {
    qc.setQueryData(["storage-settings"], res);
    toast({ title });
  }

  const save = useMutation({
    mutationFn: () => saveStorageSettings({
      provider: provider.id, location, endpoint, bucket, prefix, accessKeyId,
      // A blank field keeps the saved key.
      secretAccessKey: secretAccessKey || undefined,
      forcePathStyle,
    }),
    onSuccess: (res) => {
      setSecretAccessKey("");
      done(res, `New uploads now go to ${provider.name}`);
    },
    onError: (err) => setError(errorMessage(err, "Couldn't save the storage settings.")),
  });

  const reset = useMutation({
    mutationFn: resetStorageSettings,
    onSuccess: (res) => done(res, "New uploads use the server's settings"),
    onError: (err) => setError(errorMessage(err, "Couldn't change the storage settings.")),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div>
        <Label>Provider</Label>
        <select className={SELECT_CLASS} value={providerId} onChange={e => onProviderChange(e.target.value)}>
          {settings.providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {provider.driver === "local" && (
        <p className="text-sm rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3">
          Don't use this on DigitalOcean App Platform: its disk is wiped on every deploy, and the files go with it.
        </p>
      )}

      {isBucket && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {provider.locationLabel && (
              <div>
                <Label>{provider.locationLabel}</Label>
                <Input
                  list="storage-locations"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  required={!isCustom}
                  autoComplete="off"
                />
                <datalist id="storage-locations">
                  {provider.locations.map(l => <option key={l} value={l} />)}
                </datalist>
              </div>
            )}
            <div>
              <Label>Bucket</Label>
              <Input value={bucket} onChange={e => setBucket(e.target.value)} required autoComplete="off" />
            </div>
          </div>

          <div>
            <Label>Storage URL</Label>
            {isCustom ? (
              <Input type="url" placeholder="https://storage.example.com" value={endpoint} onChange={e => setEndpoint(e.target.value)} required />
            ) : (
              <Input value={address ?? ""} readOnly className="text-muted-foreground" />
            )}
          </div>

          <div>
            <Label>Folder <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input placeholder="e.g. production" value={prefix} onChange={e => setPrefix(e.target.value)} autoComplete="off" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Access key</Label>
              <Input value={accessKeyId} onChange={e => setAccessKeyId(e.target.value)} required autoComplete="off" />
            </div>
            <div>
              <Label>Secret key</Label>
              <PasswordInput
                autoComplete="new-password"
                placeholder={settings.hasSecret ? "Leave blank to keep the saved key" : ""}
                value={secretAccessKey}
                onChange={e => setSecretAccessKey(e.target.value)}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{provider.keyHelp} Keep the bucket private: listeners get files through this server.</p>

          {isCustom && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={forcePathStyle} onChange={e => setForcePathStyle(e.target.checked)} />
              Put the bucket in the path (needed for MinIO)
            </label>
          )}
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" isLoading={save.isPending}>Test and save</Button>
        {saved && (
          <Button
            type="button"
            variant="ghost"
            isLoading={reset.isPending}
            onClick={() => { if (confirm("Send new uploads to the location in the server's settings? Files already uploaded stay where they are.")) reset.mutate(); }}
          >
            Use server settings
          </Button>
        )}
      </div>
    </form>
  );
}

function currentLocation(s: StorageSettings) {
  const name = s.providers.find(p => p.id === s.provider)?.name ?? s.provider;
  if (s.source === "environment" && s.provider === "custom") return `${s.bucket} (from the server's settings)`;
  if (s.source === "environment") return `${name} (from the server's settings)`;
  return s.bucket ? `${name}: ${s.bucket}` : name;
}

export default function Settings() {
  const { data } = useQuery({ queryKey: ["storage-settings"], queryFn: getStorageSettings });

  return (
    <div>
      <PageHeader title="Settings" description="Where uploaded audio and video are kept." />
      <Card className="p-5 max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">Media storage</p>
            {data && <p className="text-sm text-muted-foreground truncate">New uploads go to {currentLocation(data)}</p>}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          Saving tests the location with a small file, then sends new uploads there. Files already uploaded aren't moved, and keep
          playing from where they are as long as that location and its key still work.
          {data && data.filesElsewhere > 0 && <> {plural(data.filesElsewhere)} in an earlier location.</>}
        </p>
        {data && <StorageForm key={`${data.source}:${data.provider}:${data.bucket}:${data.prefix}`} settings={data} />}
      </Card>
    </div>
  );
}
