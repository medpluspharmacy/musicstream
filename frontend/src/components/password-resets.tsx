import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import {
  listPasswordResets, listRecentPasswordResets, approvePasswordReset, declinePasswordReset, errorMessage,
  type PasswordResetRequest,
} from "@/lib";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Button, Card, StatusBadge } from "@/components/shared";

const COLORS = {
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  declined: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  "not verified": "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
};

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Approve or decline a request. Shared by the Dashboard and the Listeners page. */
export function useDecideReset() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ r, approve }: { r: PasswordResetRequest; approve: boolean }) => (approve ? approvePasswordReset(r.id) : declinePasswordReset(r.id)),
    onSuccess: (_res, { r, approve }) => {
      ["password-resets", "password-resets-recent", "dashboard-summary", "listeners"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      toast({
        title: approve ? "Password reset approved" : "Password reset declined",
        description: approve ? `${r.user.name} can sign in with their new password.` : `${r.user.name}'s password is unchanged.`,
      });
    },
    onError: (err) => toast({ title: "Couldn't update the request", description: errorMessage(err), variant: "destructive" }),
  });
}

export function confirmDecision(r: PasswordResetRequest, approve: boolean) {
  return confirm(approve
    ? `Approve the new password for ${r.user.name} (${r.user.email})? They'll be signed out everywhere and sign in with it.`
    : `Decline the password reset for ${r.user.name}? Their current password stays.`);
}

/** Approved and declined requests from the last 30 days. */
export function RecentResets({ limit }: { limit?: number }) {
  const { data = [], isLoading } = useQuery({ queryKey: ["password-resets-recent"], queryFn: listRecentPasswordResets, refetchInterval: 60_000 });
  const rows = limit ? data.slice(0, limit) : data;
  if (isLoading) return null;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground px-5 py-4">No password resets decided in the last 30 days.</p>;
  return (
    <ul className="divide-y divide-border" aria-label="Recently decided password resets">
      {rows.map(r => (
        <li key={r.id} className="px-5 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <StatusBadge status={r.status} colors={COLORS} />
          <span className="font-medium">{r.user.name}</span>
          <span className="text-muted-foreground">{r.user.email}</span>
          <span className="text-muted-foreground ml-auto">
            {r.decidedBy ? `${r.status === "approved" ? "Approved" : "Declined"} by ${r.decidedBy.name}` : r.status === "approved" ? "Approved" : "Declined"} · {when(r.decidedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Dashboard panel: requests waiting, with Approve and Decline, and recent decisions. */
export function PasswordResetsPanel() {
  const { data: pending = [] } = useQuery({ queryKey: ["password-resets"], queryFn: listPasswordResets, refetchInterval: 30_000 });
  const decide = useDecideReset();
  return (
    <Card className="mt-6" data-password-resets-panel>
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-primary" />
        <p className="font-semibold">Password resets</p>
      </div>
      <p className="px-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Waiting ({pending.length})</p>
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground px-5 py-3">Nothing waiting. A new password only works after you approve it here.</p>
      ) : (
        <ul className="divide-y divide-border" aria-label="Password resets waiting for approval">
          {pending.map(r => (
            <li key={r.id} className="px-5 py-3 flex flex-wrap items-center gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{r.user.name}{r.user.role !== "user" && <span className="ml-2 text-xs font-normal text-primary">Admin</span>}</p>
                <p className="text-xs text-muted-foreground">{r.user.email} · asked {formatDate(r.createdAt)}</p>
              </div>
              {!r.verifiedWith2fa && <StatusBadge status="not verified" colors={COLORS} />}
              <div className="ml-auto flex gap-2">
                <Button size="sm" disabled={decide.isPending} onClick={() => { if (confirmDecision(r, true)) decide.mutate({ r, approve: true }); }}>Approve</Button>
                <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => { if (confirmDecision(r, false)) decide.mutate({ r, approve: false }); }}>Decline</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="px-5 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-t border-border">Recently approved and declined</p>
      <RecentResets limit={8} />
    </Card>
  );
}
