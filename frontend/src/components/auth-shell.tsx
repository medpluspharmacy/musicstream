import { ReactNode } from "react";
import { useAppSettings } from "@/hooks/use-app-settings";
import { BrandMark } from "@/components/brand-mark";

/** Split-screen frame shared by the sign-in and sign-up pages. */
export function AuthShell({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings();
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-end p-12 bg-brand-gradient text-white">
        <h2 className="text-4xl font-bold max-w-md">{settings.loginHeadline}</h2>
        <p className="mt-4 max-w-md opacity-90">{settings.loginSubtext}</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8">
            <BrandMark logoUrl={settings.logoUrl} letter={settings.logoLetter} companyName={settings.companyName} size="lg" />
            <span className="font-bold text-2xl tracking-tight">{settings.companyName}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="text-sm rounded-xl border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3">{message}</p>
  );
}
