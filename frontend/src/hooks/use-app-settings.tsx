import { createContext, useContext, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBranding, type Branding } from "@/lib";
import { resolveApiUrl } from "@/lib/utils";

export interface AppSettings extends Branding {
  logoLetter: string;
  loginHeadline: string;
  loginSubtext: string;
}

// Matches the server's defaults (Medplus Limited, from medplusnig.com), so
// pages don't flash a different brand while the settings load.
const defaults: Branding = {
  companyName: "Medplus Limited",
  logoUrl: "/branding/medplus-logo.png",
  signInImages: ["/branding/medplus-banner-1.webp", "/branding/medplus-banner-2.webp", "/branding/medplus-banner-3.webp", "/branding/medplus-banner-4.webp"],
  sidebarImage: "/branding/medplus-banner-6.webp",
  bannerImage: "/branding/medplus-banner-1.webp",
};

const AppSettingsContext = createContext<{ settings: AppSettings }>({ settings: withExtras(defaults) });

function withExtras(b: Branding): AppSettings {
  const url = (u: string | null) => (u ? resolveApiUrl(u) : null);
  return {
    ...b,
    logoUrl: url(b.logoUrl),
    signInImages: b.signInImages.map(u => resolveApiUrl(u)),
    sidebarImage: url(b.sidebarImage),
    bannerImage: url(b.bannerImage),
    logoLetter: b.companyName.trim().charAt(0).toUpperCase() || "M",
    loginHeadline: "Every stream, at a glance.",
    loginSubtext: `${b.companyName}'s company radio. Everyone hears the same station at the same moment.`,
  };
}

/** Company name, logo and backgrounds, set by the super admin under Settings → Appearance. */
export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({ queryKey: ["branding"], queryFn: getBranding, staleTime: 5 * 60_000, retry: 1 });
  const settings = withExtras(data ?? defaults);
  useEffect(() => { document.title = `${settings.companyName} · MusicStream`; }, [settings.companyName]);
  return <AppSettingsContext.Provider value={{ settings }}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
