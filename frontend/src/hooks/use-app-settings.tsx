import { createContext, useContext, ReactNode } from "react";

export interface AppSettings {
  companyName: string;
  logoLetter: string;
  logoUrl: string | null;
  loginHeadline: string;
  loginSubtext: string;
}

// Static branding for now. If branding becomes admin-configurable, load it from
// an /api/app-settings endpoint here (see the PerformIQ pattern).
const defaults: AppSettings = {
  companyName: "MusicStream",
  logoLetter: "M",
  logoUrl: null,
  loginHeadline: "Every stream, at a glance.",
  loginSubtext: "MusicStream Dashboard brings your listening and catalogue insights into one place.",
};

const AppSettingsContext = createContext<{ settings: AppSettings }>({ settings: defaults });

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  return (
    <AppSettingsContext.Provider value={{ settings: defaults }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
