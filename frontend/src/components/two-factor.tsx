import { FormEvent, useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button, Input, Label } from "@/components/shared";
import { setup2FA, enable2FA, verify2FA, errorMessage, type Session } from "@/lib";

/**
 * Second sign-in step. `setup` shows a QR code for an authenticator app and
 * confirms the first code; `verify` just asks for the current code.
 */
export function TwoFactorStep({ mode, pendingToken, onSignedIn, onCancel }: {
  mode: "setup" | "verify";
  pendingToken: string;
  onSignedIn: (session: Session) => void;
  onCancel: () => void;
}) {
  const [qr, setQr] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode !== "setup") return;
    setup2FA(pendingToken)
      .then(setQr)
      .catch(err => setError(errorMessage(err, "Could not start two-factor setup.")));
  }, [mode, pendingToken]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = mode === "setup"
        ? await enable2FA(pendingToken, code)
        : await verify2FA(pendingToken, code);
      onSignedIn(session);
    } catch (err) {
      setError(errorMessage(err, "Could not verify the code."));
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          {mode === "setup" ? "Set up two-factor sign-in" : "Two-factor verification"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {mode === "setup"
            ? "Scan this code with an authenticator app (Google Authenticator, 1Password, Authy…), then enter the 6-digit code it shows."
            : "Enter the 6-digit code from your authenticator app."}
        </p>
      </div>

      {mode === "setup" && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4">
          {qr ? (
            <>
              <img src={qr.qrDataUrl} alt="Authenticator QR code" className="w-48 h-48 rounded-lg bg-white p-2" />
              <p className="text-xs text-muted-foreground text-center">
                Can't scan? Enter this key manually:
                <code className="block mt-1 font-mono text-foreground break-all select-all">{qr.secret}</code>
              </p>
            </>
          ) : !error && <Loader2 className="w-8 h-8 animate-spin text-muted-foreground my-16" />}
        </div>
      )}

      {error && (
        <p className="text-sm rounded-xl border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3">{error}</p>
      )}

      <div>
        <Label>Authentication code</Label>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
          autoFocus
          required
        />
      </div>

      <Button type="submit" size="lg" className="w-full" isLoading={submitting} disabled={mode === "setup" && !qr}>
        {mode === "setup" ? "Confirm and sign in" : "Verify"}
      </Button>
      <button type="button" onClick={onCancel} className="w-full text-sm text-muted-foreground hover:text-foreground">
        Back to sign in
      </button>
    </form>
  );
}
