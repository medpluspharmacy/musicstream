import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "@/hooks/use-theme";
import { Card, PageHeader } from "@/components/shared";
import { BrandingEditor } from "@/components/branding-editor";
import { useAuth } from "@/hooks/use-auth";
import { isSuperAdmin } from "@/lib/roles";

const OPTIONS: { value: ThemePreference; label: string; description: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", description: "Light backgrounds", icon: Sun },
  { value: "dark", label: "Dark", description: "Easier on the eyes at night", icon: Moon },
  { value: "system", label: "System", description: "Match this device's setting", icon: Monitor },
];

/** A small picture of the dashboard in one theme. */
function Preview({ dark }: { dark: boolean }) {
  const page = dark ? "bg-[#0c0c0f]" : "bg-[#fafafa]";
  const card = dark ? "bg-[#16161b] border-white/10" : "bg-white border-black/10";
  const line = dark ? "bg-white/15" : "bg-black/10";
  return (
    <div className={`h-20 rounded-lg border ${card} ${page} p-2 flex gap-2`} aria-hidden>
      <div className={`w-1/4 rounded-md ${card} border p-1.5 space-y-1`}>
        <div className="h-1.5 rounded-full bg-brand-gradient" />
        <div className={`h-1.5 rounded-full ${line}`} />
        <div className={`h-1.5 rounded-full ${line}`} />
      </div>
      <div className={`flex-1 rounded-md ${card} border p-1.5 space-y-1.5`}>
        <div className={`h-1.5 w-1/2 rounded-full ${line}`} />
        <div className={`h-1.5 w-3/4 rounded-full ${line}`} />
        <div className={`h-3 w-10 rounded ${dark ? "bg-[#ff3a9c]" : "bg-[#e00069]"}`} />
      </div>
    </div>
  );
}

export default function Appearance() {
  const { preference, resolved, setPreference } = useTheme();
  const { user } = useAuth();

  return (
    <div>
      <PageHeader title="Appearance" description={isSuperAdmin(user) ? "Your theme on this device, and the company's branding." : "How the dashboard looks on this device."} />
      <Card className="p-5 max-w-3xl">
        <p className="font-semibold">Theme</p>
        <div role="radiogroup" aria-label="Theme" className="mt-4 grid gap-3 sm:grid-cols-3">
          {OPTIONS.map(o => {
            const selected = preference === o.value;
            const showsDark = o.value === "system" ? resolved === "dark" : o.value === "dark";
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPreference(o.value)}
                className={`text-left rounded-xl border p-3 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
                  selected ? "border-primary ring-1 ring-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <Preview dark={showsDark} />
                <div className="mt-3 flex items-center gap-2">
                  <o.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium flex-1">{o.label}</span>
                  {selected && <Check className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{o.description}</p>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-4">Saved in this browser, so you can choose differently on each device.</p>
      </Card>
      {isSuperAdmin(user) && <BrandingEditor />}
    </div>
  );
}
