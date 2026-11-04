import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import {
  listAdmins, listListeners, promoteAdmin, updateAdminPermissions, removeAdmin, errorMessage,
  type Permission, type User,
} from "@/lib";
import { PERMISSION_LABELS, roleLabel } from "@/lib/roles";
import { useToast } from "@/hooks/use-toast";
import { Button, Card, Label, PageHeader } from "@/components/shared";

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

function PermissionPicker({ value, onChange, disabled }: { value: Permission[]; onChange: (p: Permission[]) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {ALL_PERMISSIONS.map(p => (
        <label
          key={p}
          className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition-colors ${
            value.includes(p) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
          } ${disabled ? "opacity-60 pointer-events-none" : ""}`}
        >
          <input
            type="checkbox"
            className="mt-0.5 accent-[hsl(var(--primary))]"
            checked={value.includes(p)}
            disabled={disabled}
            onChange={e => onChange(e.target.checked ? [...value, p] : value.filter(x => x !== p))}
          />
          <span>
            <span className="font-medium block">{PERMISSION_LABELS[p].name}</span>
            <span className="text-xs text-muted-foreground">{PERMISSION_LABELS[p].description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function AdminRow({ admin }: { admin: User }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [perms, setPerms] = useState<Permission[]>(admin.permissions);
  const changed = [...perms].sort().join() !== [...admin.permissions].sort().join();
  const refresh = () => ["team", "listeners"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  const save = useMutation({
    mutationFn: () => updateAdminPermissions(admin.id, perms),
    onSuccess: () => { refresh(); toast({ title: "Access updated", description: `${admin.name}'s changes apply straight away.` }); },
    onError: (err) => toast({ title: "Couldn't update access", description: errorMessage(err), variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: () => removeAdmin(admin.id),
    onSuccess: () => { refresh(); toast({ title: "Admin rights removed", description: `${admin.name} is now a listener.` }); },
    onError: (err) => toast({ title: "Couldn't remove admin", description: errorMessage(err), variant: "destructive" }),
  });
  const isOwner = admin.role === "super_admin";

  return (
    <li className="px-5 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium truncate">{admin.name}</p>
          <p className="text-xs text-muted-foreground truncate">{admin.email} · {roleLabel(admin)}</p>
        </div>
        {!isOwner && (
          <Button
            variant="ghost"
            size="sm"
            isLoading={remove.isPending}
            onClick={() => { if (confirm(`Remove admin rights from ${admin.name}? They'll keep listening access.`)) remove.mutate(); }}
          >
            Remove admin
          </Button>
        )}
      </div>
      {isOwner ? (
        <p className="text-sm text-muted-foreground">Full access to everything, including the admin team.</p>
      ) : (
        <>
          <PermissionPicker value={perms} onChange={setPerms} disabled={save.isPending} />
          {changed && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => save.mutate()} isLoading={save.isPending} disabled={perms.length === 0}>Save access</Button>
              <Button size="sm" variant="ghost" onClick={() => setPerms(admin.permissions)}>Cancel</Button>
              {perms.length === 0 && <p className="text-xs text-destructive self-center">Pick at least one area, or remove them as admin.</p>}
            </div>
          )}
        </>
      )}
    </li>
  );
}

function PromoteCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: listeners = [] } = useQuery({ queryKey: ["listeners"], queryFn: listListeners });
  const eligible = listeners.filter(l => l.isActive && l.approvalStatus === "approved" && l.totpEnabled);
  const [userId, setUserId] = useState("");
  const [perms, setPerms] = useState<Permission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const promote = useMutation({
    mutationFn: () => promoteAdmin(Number(userId), perms),
    onSuccess: (u) => {
      ["team", "listeners"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      setUserId(""); setPerms([]);
      toast({ title: "Admin added", description: `${u.name} will see their new menus within 30 seconds.` });
    },
    onError: (err) => setError(errorMessage(err, "Couldn't add admin.")),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    promote.mutate();
  }

  return (
    <Card className="p-5 mb-6">
      <p className="font-semibold">Add an admin</p>
      <p className="text-sm text-muted-foreground mt-1">
        Ask them to sign up and set up 2FA, approve them on the Listeners page, then pick them here.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <Label>Person</Label>
          <select
            value={userId}
            onChange={e => setUserId(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20"
          >
            <option value="">{eligible.length ? "Choose an approved listener…" : "No approved listeners with 2FA yet"}</option>
            {eligible.map(l => <option key={l.id} value={l.id}>{l.name} ({l.email})</option>)}
          </select>
        </div>
        <div>
          <Label>What they can manage</Label>
          <PermissionPicker value={perms} onChange={setPerms} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" isLoading={promote.isPending} disabled={!userId || perms.length === 0}>Make admin</Button>
      </form>
    </Card>
  );
}

export default function Team() {
  const { data: admins = [] } = useQuery({ queryKey: ["team"], queryFn: listAdmins });
  return (
    <div>
      <PageHeader title="Admin team" description="Delegate parts of the dashboard. Every admin can see the Dashboard; you choose the rest." />
      <PromoteCard />
      <Card>
        <p className="px-5 pt-4 pb-2 text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> Admins
        </p>
        <ul className="divide-y divide-border">
          {admins.map(a => <AdminRow key={`${a.id}:${a.permissions.join()}`} admin={a} />)}
        </ul>
      </Card>
    </div>
  );
}
