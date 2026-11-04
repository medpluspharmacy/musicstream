import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import {
  listListeners, setListenerActive, resetListener2FA, approveListener, declineListener, errorMessage, type User,
} from "@/lib";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Button, Card, EmptyState, Input, PageHeader, StatusBadge } from "@/components/shared";

const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  awaiting_approval: "bg-violet-100 text-violet-700 border-violet-200",
  awaiting_2fa: "bg-amber-100 text-amber-700 border-amber-200",
  declined: "bg-red-100 text-red-700 border-red-200",
  deactivated: "bg-slate-100 text-slate-600 border-slate-200",
};

function statusOf(u: User) {
  if (!u.isActive) return "deactivated";
  if (u.approvalStatus === "pending") return "awaiting_approval";
  if (u.approvalStatus === "declined") return "declined";
  return u.totpEnabled ? "active" : "awaiting_2fa";
}

const isPending = (u: User) => u.isActive && u.approvalStatus === "pending";

export default function Listeners() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"pending" | "all" | null>(null);
  const { data: listeners = [], isLoading } = useQuery({ queryKey: ["listeners"], queryFn: listListeners, refetchInterval: 30_000 });
  const pendingCount = listeners.filter(isPending).length;
  // Open on the waiting list when there is one.
  const view = tab ?? (pendingCount > 0 ? "pending" : "all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inView = view === "pending" ? listeners.filter(isPending) : listeners;
    return q ? inView.filter(l => `${l.name} ${l.email}`.toLowerCase().includes(q)) : inView;
  }, [listeners, search, view]);

  const onError = (title: string) => (err: unknown) => toast({ title, description: errorMessage(err), variant: "destructive" });
  const refresh = () => ["listeners", "dashboard-summary"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  const approve = useMutation({
    mutationFn: (u: User) => approveListener(u.id),
    onSuccess: (u) => { refresh(); toast({ title: "Approved", description: `${u.name} can now listen.` }); },
    onError: onError("Couldn't approve"),
  });
  const decline = useMutation({
    mutationFn: (u: User) => declineListener(u.id),
    onSuccess: (u) => { refresh(); toast({ title: "Declined", description: `${u.name} can't sign in.` }); },
    onError: onError("Couldn't decline"),
  });
  const toggle = useMutation({
    mutationFn: (u: User) => setListenerActive(u.id, !u.isActive),
    onSuccess: refresh,
    onError: onError("Couldn't update listener"),
  });
  const reset = useMutation({
    mutationFn: (u: User) => resetListener2FA(u.id),
    onSuccess: (u) => { refresh(); toast({ title: "2FA reset", description: `${u.name} will set up 2FA again at next sign-in.` }); },
    onError: onError("Couldn't reset 2FA"),
  });

  return (
    <div>
      <PageHeader title="Listeners" description="Everyone who has signed up. New sign-ups can't listen until you approve them." />

      {!isLoading && listeners.length === 0 ? (
        <EmptyState icon={Users} title="No listeners yet" description="Share the sign-up link. New sign-ups appear here for you to approve." />
      ) : (
        <Card>
          <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3">
            <div className="inline-flex rounded-xl border border-border p-1 bg-muted/40 shrink-0 self-start">
              {([["pending", `Waiting for approval (${pendingCount})`], ["all", `All (${listeners.length})`]] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  aria-pressed={view === value}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    view === value ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Input placeholder="Search by name or email" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {filtered.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              {view === "pending" && !search ? "No one is waiting for approval." : "No listeners match."}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">Joined</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(l => (
                  <tr key={l.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.email}</p>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={statusOf(l)} colors={STATUS_COLORS} /></td>
                    <td className="px-5 py-3 hidden md:table-cell text-muted-foreground">{formatDate(l.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        {l.isActive && l.approvalStatus !== "approved" && (
                          <Button size="sm" onClick={() => approve.mutate(l)} disabled={approve.isPending}>Approve</Button>
                        )}
                        {l.isActive && l.approvalStatus === "pending" && (
                          <Button variant="outline" size="sm" disabled={decline.isPending}
                            onClick={() => { if (confirm(`Decline ${l.name} (${l.email})? They won't be able to sign in.`)) decline.mutate(l); }}>
                            Decline
                          </Button>
                        )}
                        {l.approvalStatus === "approved" && l.totpEnabled && (
                          <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Reset 2FA for ${l.name}? They'll need to scan a new QR code.`)) reset.mutate(l); }}>
                            Reset 2FA
                          </Button>
                        )}
                        {(l.approvalStatus === "approved" || !l.isActive) && (
                          <Button variant={l.isActive ? "outline" : "secondary"} size="sm" onClick={() => toggle.mutate(l)}>
                            {l.isActive ? "Deactivate" : "Reactivate"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
