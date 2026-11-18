import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import {
  listListeners, listConnectedListeners, setListenerActive, signOutListener, resetListener2FA, approveListener, declineListener,
  listPasswordResets, approvePasswordReset, declinePasswordReset,
  errorMessage, type ConnectedListener, type PasswordResetRequest, type User,
} from "@/lib";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Button, Card, EmptyState, Input, PageHeader, StatusBadge } from "@/components/shared";
import { RecentResets } from "@/components/password-resets";

const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  awaiting_approval: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  awaiting_2fa: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  declined: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  deactivated: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
};

function statusOf(u: User) {
  if (!u.isActive) return "deactivated";
  if (u.approvalStatus === "pending") return "awaiting_approval";
  if (u.approvalStatus === "declined") return "declined";
  return u.totpEnabled ? "active" : "awaiting_2fa";
}

const isPending = (u: User) => u.isActive && u.approvalStatus === "pending";

const RESET_COLORS = {
  "authenticator code": "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  "not verified": "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
};

const PRESENCE_COLORS = {
  listening: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  "on the page": "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
};

/** "3 min", "1 h 20 min": how long since `iso`. */
function since(iso: string, now: number) {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ""}`;
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function PasswordResetTable({ requests, search, onDecide, busy }: {
  requests: PasswordResetRequest[];
  search: string;
  onDecide: (r: PasswordResetRequest, approve: boolean) => void;
  busy: boolean;
}) {
  const q = search.trim().toLowerCase();
  const shown = q ? requests.filter(r => `${r.user.name} ${r.user.email}`.toLowerCase().includes(q)) : requests;
  if (shown.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{q ? "No requests match." : "No password resets are waiting."}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-5 py-3 font-medium">Name</th>
            <th className="px-5 py-3 font-medium">Identity check</th>
            <th className="px-5 py-3 font-medium hidden md:table-cell">Requested</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {shown.map(r => (
            <tr key={r.id}>
              <td className="px-5 py-3">
                <p className="font-medium">{r.user.name}{r.user.role !== "user" && <span className="ml-2 text-xs font-normal text-primary">Admin</span>}</p>
                <p className="text-xs text-muted-foreground">{r.user.email}</p>
              </td>
              <td className="px-5 py-3">
                <StatusBadge status={r.verifiedWith2fa ? "authenticator code" : "not verified"} colors={RESET_COLORS} />
                {!r.verifiedWith2fa && <p className="text-xs text-muted-foreground mt-1">Never set up 2FA. Check who this is first.</p>}
              </td>
              <td className="px-5 py-3 hidden md:table-cell text-muted-foreground">{formatDate(r.createdAt)}</td>
              <td className="px-5 py-3">
                <div className="flex justify-end gap-2">
                  <Button size="sm" disabled={busy}
                    onClick={() => { if (confirm(`Approve the new password for ${r.user.name} (${r.user.email})? They'll be signed out everywhere and sign in with it.`)) onDecide(r, true); }}>
                    Approve
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy}
                    onClick={() => { if (confirm(`Decline the password reset for ${r.user.name}? Their current password stays.`)) onDecide(r, false); }}>
                    Decline
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConnectedTable({ people, search, onSignOut, onDeactivate, busy }: {
  people: ConnectedListener[];
  search: string;
  onSignOut: (c: ConnectedListener) => void;
  onDeactivate: (c: ConnectedListener) => void;
  busy: boolean;
}) {
  const now = useNow(30_000);
  const q = search.trim().toLowerCase();
  const shown = q ? people.filter(c => `${c.name} ${c.email}`.toLowerCase().includes(q)) : people;
  if (shown.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">
        {q ? "No connected listeners match." : "No one has the Listen page open right now."}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-5 py-3 font-medium">Name</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium hidden md:table-cell">Connected for</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {shown.map(c => (
            <tr key={c.id}>
              <td className="px-5 py-3">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.email}</p>
              </td>
              <td className="px-5 py-3">
                <StatusBadge status={c.listening ? "listening" : "on the page"} colors={PRESENCE_COLORS} />
                {c.listening && c.listeningSince && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {since(c.listeningSince, now) === "just now" ? "just started" : `for ${since(c.listeningSince, now)}`}
                  </p>
                )}
              </td>
              <td className="px-5 py-3 hidden md:table-cell text-muted-foreground">{since(c.connectedSince, now)}</td>
              <td className="px-5 py-3">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" disabled={busy}
                    onClick={() => { if (confirm(`Sign out ${c.name}? Their player stops, and they can sign in again.`)) onSignOut(c); }}>
                    Sign out
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy}
                    onClick={() => { if (confirm(`Deactivate ${c.name} (${c.email})? Their player stops, and they can't sign in until you reactivate them.`)) onDeactivate(c); }}>
                    Deactivate
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Listeners() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"pending" | "connected" | "resets" | "all" | null>(null);
  const { data: listeners = [], isLoading } = useQuery({ queryKey: ["listeners"], queryFn: listListeners, refetchInterval: 30_000 });
  // Refreshes faster on its own tab, so the list stays close to live.
  const { data: resets = [], isSuccess: resetsLoaded } = useQuery({ queryKey: ["password-resets"], queryFn: listPasswordResets, refetchInterval: 30_000 });
  const { data: connected = [] } = useQuery({
    queryKey: ["listeners-connected"],
    queryFn: listConnectedListeners,
    refetchInterval: tab === "connected" ? 10_000 : 30_000,
  });
  const pendingCount = listeners.filter(isPending).length;
  // Open on the waiting list when there is one.
  const view = tab ?? (pendingCount > 0 ? "pending" : resets.length > 0 ? "resets" : "all");
  // Settle on the opening tab once loaded, so approving the last item doesn't jump to another tab.
  useEffect(() => { if (tab === null && !isLoading && resetsLoaded) setTab(view); }, [tab, isLoading, resetsLoaded]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inView = view === "pending" ? listeners.filter(isPending) : view === "all" ? listeners : [];
    return q ? inView.filter(l => `${l.name} ${l.email}`.toLowerCase().includes(q)) : inView;
  }, [listeners, search, view]);

  const onError = (title: string) => (err: unknown) => toast({ title, description: errorMessage(err), variant: "destructive" });
  const refresh = () => ["listeners", "listeners-connected", "password-resets", "password-resets-recent", "dashboard-summary"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
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
  const decideReset = useMutation({
    mutationFn: ({ r, approve }: { r: PasswordResetRequest; approve: boolean }) => (approve ? approvePasswordReset(r.id) : declinePasswordReset(r.id)),
    onSuccess: (_res, { r, approve }) => {
      refresh();
      toast({ title: approve ? "Password reset approved" : "Password reset declined", description: approve ? `${r.user.name} can sign in with their new password.` : `${r.user.name}'s password is unchanged.` });
    },
    onError: onError("Couldn't update the request"),
  });
  const signOut = useMutation({
    mutationFn: (c: ConnectedListener) => signOutListener(c.id),
    onSuccess: (u) => { refresh(); toast({ title: "Signed out", description: `${u.name}'s player has stopped. They can sign in again.` }); },
    onError: onError("Couldn't sign out"),
  });
  const deactivate = useMutation({
    mutationFn: (c: ConnectedListener) => setListenerActive(c.id, false),
    onSuccess: (u) => { refresh(); toast({ title: "Deactivated", description: `${u.name} can't sign in until you reactivate them.` }); },
    onError: onError("Couldn't deactivate"),
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
              {([["pending", `Waiting for approval (${pendingCount})`], ["connected", `Connected (${connected.length})`], ["resets", `Password resets (${resets.length})`], ["all", `All (${listeners.length})`]] as const).map(([value, label]) => (
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
          {view === "resets" && (
            <>
              <PasswordResetTable requests={resets} search={search} busy={decideReset.isPending} onDecide={(r, approve) => decideReset.mutate({ r, approve })} />
              <p className="px-5 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-t border-border">Recently approved and declined</p>
              <RecentResets />
            </>
          )}
          {view === "connected" && (
            <ConnectedTable
              people={connected}
              search={search}
              onSignOut={c => signOut.mutate(c)}
              onDeactivate={c => deactivate.mutate(c)}
              busy={signOut.isPending || deactivate.isPending}
            />
          )}
          {(view === "pending" || view === "all") && filtered.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              {view === "pending" && !search ? "No one is waiting for approval." : "No listeners match."}
            </p>
          )}
          {(view === "pending" || view === "all") && <div className="overflow-x-auto">
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
          </div>}
        </Card>
      )}
    </div>
  );
}
