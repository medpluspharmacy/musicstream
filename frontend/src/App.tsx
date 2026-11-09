import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryCache, MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppSettingsProvider } from "@/hooks/use-app-settings";
import { AppLayout } from "@/components/layout";
import { FullPageLoader } from "@/components/shared";
import { handleUnauthorized } from "@/lib/utils";
import { canAccess, landingPath, type Access } from "@/lib/roles";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Media from "@/pages/media";
import Playlist from "@/pages/playlist";
import Listeners from "@/pages/listeners";
import Team from "@/pages/team";
import Integrations from "@/pages/integrations";
import Settings from "@/pages/settings";
import Appearance from "@/pages/appearance";
import { ThemeProvider } from "@/hooks/use-theme";
import Listen from "@/pages/listen";

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleUnauthorized }),
  mutationCache: new MutationCache({ onError: handleUnauthorized }),
  defaultOptions: { queries: { retry: 1 } },
});

// Protected Route wrapper. Users without `access` go back to their landing
// page; the server enforces the same rules on every admin endpoint.
function ProtectedRoute({ component: Component, access }: { component: React.ComponentType; access: Access }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <FullPageLoader />;
  if (!user) return <Redirect to="/login" />;
  if (!canAccess(user, access)) return <Redirect to={landingPath(user)} />;
  
  return <Component />;
}

const PAGES: [string, React.ComponentType, Access][] = [
  ["/listen", Listen, "everyone"],
  ["/dashboard", Dashboard, "admin"],
  ["/media", Media, "station"],
  ["/playlist", Playlist, "station"],
  ["/listeners", Listeners, "listeners"],
  ["/team", Team, "super_admin"],
  ["/integrations", Integrations, "integrations"],
  ["/settings/storage", Settings, "super_admin"],
  ["/settings/appearance", Appearance, "everyone"],
];

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <FullPageLoader />;

  return (
    <Switch>
      <Route path="/">
        {user ? <Redirect to={landingPath(user)} /> : <Redirect to="/login" />}
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Protected Routes wrapped in Layout */}
      {PAGES.map(([path, component, access]) => (
        <Route key={path} path={path}>
          <AppLayout><ProtectedRoute component={component} access={access} /></AppLayout>
        </Route>
      ))}

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppSettingsProvider>
            <AuthProvider>
              <Router />
              <Toaster />
            </AuthProvider>
          </AppSettingsProvider>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
