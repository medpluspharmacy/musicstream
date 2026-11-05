import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Radio,
  Library,
  ListMusic,
  Users,
  ShieldCheck,
  Plug,
  Settings,
  HardDrive,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "@/lib";
import { canAccess, roleLabel, type Access } from "@/lib/roles";
import { useAppSettings } from "@/hooks/use-app-settings";
import { BrandMark } from "@/components/brand-mark";

interface NavItem {
  name: string;
  path: string;
  icon: any;
  access: Access;
}

interface NavGroup {
  label: string;
  icon: any;
  items: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

const NAV_STRUCTURE: NavEntry[] = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, access: "admin" },
  { name: "Listen", path: "/listen", icon: Radio, access: "everyone" },
  {
    label: "Station",
    icon: ListMusic,
    items: [
      { name: "Media Library", path: "/media", icon: Library, access: "station" },
      { name: "Playlist", path: "/playlist", icon: ListMusic, access: "station" },
    ],
  },
  {
    label: "People",
    icon: Users,
    items: [
      { name: "Listeners", path: "/listeners", icon: Users, access: "listeners" },
      { name: "Admin team", path: "/team", icon: ShieldCheck, access: "super_admin" },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    items: [
      { name: "Integrations", path: "/integrations", icon: Plug, access: "integrations" },
      { name: "Storage", path: "/settings", icon: HardDrive, access: "super_admin" },
    ],
  },
];

interface NavLinksProps {
  user: User;
  onNavigate?: () => void;
}

function NavLinks({ user, onNavigate }: NavLinksProps) {
  const [location] = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      NAV_STRUCTURE.forEach((entry) => {
        if (isGroup(entry)) {
          const hasActive = entry.items.some(
            (item) => location === item.path || location.startsWith(`${item.path}/`)
          );
          if (hasActive) next[entry.label] = true;
        }
      });
      return next;
    });
  }, [location]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function isItemVisible(item: NavItem): boolean {
    return canAccess(user, item.access);
  }

  return (
    <nav className="flex-1 space-y-0.5">
      {NAV_STRUCTURE.map((entry) => {
        if (isGroup(entry)) {
          const visibleItems = entry.items.filter(isItemVisible);
          if (visibleItems.length === 0) return null;

          const isOpen = openGroups[entry.label] ?? true;
          const hasActive = visibleItems.some(
            (item) => location === item.path || location.startsWith(`${item.path}/`)
          );

          return (
            <div key={entry.label} className="pt-1">
              <button
                onClick={() => toggleGroup(entry.label)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-xs font-semibold uppercase tracking-wider ${
                  hasActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <entry.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{entry.label}</span>
                {isOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
                )}
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-3 pl-3 border-l-2 border-border space-y-0.5 py-0.5">
                      {visibleItems.map((item) => {
                        const isActive = location === item.path || location.startsWith(`${item.path}/`);
                        return (
                          <Link
                            key={item.path}
                            href={item.path}
                            onClick={onNavigate}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 font-medium text-sm ${
                              isActive
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <item.icon className="w-4 h-4 shrink-0" />
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        }

        if (!isItemVisible(entry)) return null;
        const isActive = location === entry.path || location.startsWith(`${entry.path}/`);
        return (
          <Link
            key={entry.path}
            href={entry.path}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <entry.icon className="w-5 h-5 shrink-0" />
            {entry.name}
          </Link>
        );
      })}
    </nav>
  );
}

function userInitial(user: User): string {
  return (user.name ?? user.email ?? "U").charAt(0).toUpperCase();
}

function userDisplayName(user: User): string {
  return user.name ?? user.email ?? "Unknown";
}

function UserFooter({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <div className="border-t border-border p-4 space-y-1">
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm border border-border shrink-0">
          {userInitial(user)}
        </div>
        <div className="overflow-hidden flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{userDisplayName(user)}</p>
          <p className="text-xs text-muted-foreground capitalize truncate">{roleLabel(user)}</p>
        </div>
      </div>
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors font-medium"
      >
        <LogOut className="w-4 h-4 shrink-0" />
        Sign out
      </button>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { settings } = useAppSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden sm:flex flex-col w-64 shrink-0 border-r border-border bg-card sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <BrandMark logoUrl={settings.logoUrl} letter={settings.logoLetter} companyName={settings.companyName} size="md" />
          <span className="font-bold text-xl tracking-tight">{settings.companyName}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <NavLinks user={user} />
        </div>

        <UserFooter user={user} onLogout={logout} />
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 sm:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed top-0 left-0 h-full w-72 z-50 flex flex-col bg-card border-r border-border shadow-2xl sm:hidden"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <BrandMark logoUrl={settings.logoUrl} letter={settings.logoLetter} companyName={settings.companyName} size="md" />
                  <span className="font-bold text-xl tracking-tight">{settings.companyName}</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3">
                <NavLinks user={user} onNavigate={() => setSidebarOpen(false)} />
              </div>

              <UserFooter user={user} onLogout={logout} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="sm:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-card border-b border-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <BrandMark logoUrl={settings.logoUrl} letter={settings.logoLetter} companyName={settings.companyName} size="sm" />
            <span className="font-bold text-base tracking-tight">{settings.companyName}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm border border-border">
            {userInitial(user)}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto pb-8"
          >
            {children}
          </motion.div>
        </main>

        <div className="sticky bottom-0 z-20 border-t border-border bg-card/90 backdrop-blur-sm px-4 py-2">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
        </div>
      </div>
    </div>
  );
}
