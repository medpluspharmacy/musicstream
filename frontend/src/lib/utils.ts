import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ApiError } from "./custom-fetch"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Prefixes an API path with VITE_API_URL so it works when the SPA and API are on different origins. */
export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  return `${base}${path}`;
}

/**
 * Global session-invalidation handler: if the backend rejects the session
 * token, surface it to the auth layer so the user is bounced to /login with a
 * clear notice.
 */
export function handleUnauthorized(err: unknown) {
  if (!(err instanceof ApiError) || err.status !== 401 || !localStorage.getItem("token")) return;
  if (err.url.includes("/api/auth/")) return;
  const reason = (err.data as { reason?: string } | null)?.reason;
  sessionStorage.setItem("authNotice", reason === "session_replaced" ? "session_replaced" : "session_expired");
  window.dispatchEvent(new CustomEvent("auth:invalid"));
}
