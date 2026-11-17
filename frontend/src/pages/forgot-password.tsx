import { FormEvent, useState } from "react";
import { Link, Redirect } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AuthShell, FormError } from "@/components/auth-shell";
import { Button, Input, Label, PasswordInput } from "@/components/shared";
import { requestPasswordReset, errorMessage } from "@/lib";
import { landingPath } from "@/lib/roles";

/**
 * No email is sent, so the authenticator code proves who's asking, and an admin
 * approves the change. The old password keeps working until then.
 */
export default function ForgotPassword() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  if (user) return <Redirect to={landingPath(user)} />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setSubmitting(true);
    try {
      await requestPasswordReset({ email, newPassword: password, code });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, "Couldn't send your request. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      {sent ? (
        <div className="space-y-4" role="status">
          <CheckCircle2 className="w-10 h-10 text-primary" />
          <h1 className="text-2xl font-bold">Request sent</h1>
          <p className="text-muted-foreground">
            If your email and authenticator code were right, an admin will review your request. Once they approve it,
            sign in with your new password. Until then, your old password still works.
          </p>
          <p className="text-sm text-muted-foreground">
            Not approved after a while? Check you used the current code from your authenticator app, or contact an admin.
          </p>
          <Link href="/login" className="inline-block text-primary font-medium hover:underline">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold">Forgot password</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Choose a new password. An admin approves the change before it works.
            </p>
          </div>
          <FormError message={error} />
          <div>
            <Label htmlFor="fp-email">Email</Label>
            <Input id="fp-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="fp-password">New password</Label>
            <PasswordInput id="fp-password" autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
            <p className="text-xs text-muted-foreground mt-1">At least 8 characters.</p>
          </div>
          <div>
            <Label htmlFor="fp-confirm">Confirm new password</Label>
            <PasswordInput id="fp-confirm" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="fp-code">Authenticator code</Label>
            <Input
              id="fp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              From the authenticator app you use to sign in. If you never finished setting it up, leave this blank.
            </p>
          </div>
          <Button type="submit" size="lg" className="w-full" isLoading={submitting}>Send request</Button>
          <p className="text-sm text-center text-muted-foreground">
            Remembered it? <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
