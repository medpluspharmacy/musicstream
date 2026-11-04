// @refresh reset
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useLocation } from "wouter";
import { User, getMe, logoutSession } from "../lib";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  /** Re-reads the signed-in user, e.g. to pick up an approval or permission change. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
// Approvals and permission changes made by an admin show up within this long.
const USER_REFRESH_MS = 30 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("token");
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await getMe();
        setUser(userData);
      } catch (error) {
        // A 401 just means the stored session was ended (sign-out elsewhere, deactivation).
        if ((error as { status?: number })?.status !== 401) console.error("Auth init failed:", error);
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
    sessionStorage.removeItem("authNotice");
  };

  const logout = () => {
    // Best effort: end the session server-side too.
    if (localStorage.getItem("token")) logoutSession().catch(() => {});
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setLocation("/login");
  };

  // Idle-timeout auto-logout: only active while the user is signed in.
  useEffect(() => {
    if (!token) return;

    const reset = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        // Listening to the station counts as activity.
        const playing = Array.from(document.querySelectorAll<HTMLMediaElement>("audio, video")).some(m => !m.paused);
        if (playing) { reset(); return; }
        sessionStorage.setItem("authNotice", "idle_timeout");
        logout();
      }, IDLE_TIMEOUT_MS);
    };

    const events: (keyof DocumentEventMap)[] = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [token]);

  const refreshUser = async () => {
    if (!localStorage.getItem("token")) return;
    try {
      setUser(await getMe());
    } catch (error) {
      // The 30s poll is often the first to notice a deactivation or a sign-in elsewhere.
      if ((error as { status?: number })?.status === 401) {
        sessionStorage.setItem("authNotice", "session_replaced");
        window.dispatchEvent(new CustomEvent("auth:invalid"));
      }
    }
  };

  useEffect(() => {
    if (!token) return;
    const timer = setInterval(refreshUser, USER_REFRESH_MS);
    return () => clearInterval(timer);
  }, [token]);

  // Global hook: any 401 on an API call bounces the user to /login.
  useEffect(() => {
    const onInvalid = () => {
      if (!localStorage.getItem("token")) return;
      localStorage.removeItem("token");
      logout();
    };
    window.addEventListener("auth:invalid", onInvalid);
    return () => window.removeEventListener("auth:invalid", onInvalid);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
