import { FormEvent, useState } from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AuthShell, FormError } from "@/components/auth-shell";
import { TwoFactorStep } from "@/components/two-factor";
import { Button, Input, Label, PasswordInput } from "@/components/shared";
import { login as loginRequest, errorMessage, type PendingSignIn } from "@/lib";
import { landingPath } from "@/lib/roles";

const NOTICES: Record<string, string> = {
  session_replaced: "You were signed out because your account signed in elsewhere.",
  session_expired: "Your session expired. Please sign in again.",
  idle_timeout: "You were signed out after a period of inactivity.",
};

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<PendingSignIn | null>(null);
  const notice = NOTICES[sessionStorage.getItem("authNotice") ?? ""];

  if (user) return <Redirect to={landingPath(user)} />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      setPending(await loginRequest({ email, password }));
    } catch (err) {
      setError(errorMessage(err, "Could not sign in. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      {pending ? (
        <TwoFactorStep
          mode={pending.requires2FASetup ? "setup" : "verify"}
          pendingToken={pending.pendingToken}
          onSignedIn={(s) => login(s.token, s.user)}
          onCancel={() => { setPending(null); setPassword(""); }}
        />
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold">Sign in</h1>
            <p className="text-muted-foreground text-sm mt-1">Use your work email and password.</p>
          </div>

          {notice && !error && (
            <p className="text-sm rounded-xl border border-border bg-muted px-4 py-3">{notice}</p>
          )}
          <FormError message={error} />

          <div>
            <Label>Email</Label>
            <Input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Password</Label>
            <PasswordInput autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          <Button type="submit" size="lg" className="w-full" isLoading={submitting}>
            Continue
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            New here? <Link href="/register" className="text-primary font-medium hover:underline">Create an account</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
