import { FormEvent, useState } from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AuthShell, FormError } from "@/components/auth-shell";
import { TwoFactorStep } from "@/components/two-factor";
import { Button, Input, Label, PasswordInput } from "@/components/shared";
import { register, errorMessage } from "@/lib";
import { landingPath } from "@/lib/roles";

export default function Register() {
  const { user, login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  if (user) return <Redirect to={landingPath(user)} />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setSubmitting(true);
    try {
      const res = await register({ name, email, password });
      setPendingToken(res.pendingToken);
    } catch (err) {
      setError(errorMessage(err, "Could not create your account. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      {pendingToken ? (
        <TwoFactorStep
          mode="setup"
          pendingToken={pendingToken}
          onSignedIn={(s) => login(s.token, s.user)}
          onCancel={() => setPendingToken(null)}
        />
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold">Create your account</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Sign up, then an admin will approve your account before you can listen.
            </p>
          </div>

          <FormError message={error} />

          <div>
            <Label>Full name</Label>
            <Input autoComplete="name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Password</Label>
            <PasswordInput autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
            <p className="text-xs text-muted-foreground mt-1">At least 8 characters.</p>
          </div>
          <div>
            <Label>Confirm password</Label>
            <PasswordInput autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>

          <Button type="submit" size="lg" className="w-full" isLoading={submitting}>
            Continue
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Already have an account? <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
