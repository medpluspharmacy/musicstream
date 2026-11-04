// Typed API client. Add one function per backend endpoint, mirroring the
// routes in backend/src/routes/.
import { customFetch, ApiError } from "./custom-fetch";
import { resolveApiUrl } from "./utils";

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  totpEnabled: boolean;
  approvalStatus: ApprovalStatus;
  /** Admin areas this account can manage; the super admin has all of them. */
  permissions: Permission[];
  createdAt: string;
}

export type ApprovalStatus = "pending" | "approved" | "declined";
export type Permission = "station" | "listeners" | "integrations";

export interface Session {
  token: string;
  user: User;
}

/** Returned by login/register: the password step passed, a second factor is needed. */
export interface PendingSignIn {
  requires2FA: boolean;
  requires2FASetup: boolean;
  pendingToken: string;
}

export interface DashboardSummary {
  listeners: number;
  activeListeners: number;
  pending2FA: number;
  newListenersThisWeek: number;
  mediaCount: number;
  pendingApproval: number;
  station: StationStatus;
}

export type StationSource = "playlist" | "azuracast";

export interface StationStatus {
  live: boolean;
  startedAt: string | null;
  source: StationSource;
  /** Station short name when AzuraCast is connected. */
  azuracastStation: string | null;
  itemCount: number;
  totalDurationSeconds: number;
}

export type MediaKind = "audio" | "video";

export interface MediaFile {
  id: number;
  title: string;
  kind: MediaKind;
  provider: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
  originalName: string | null;
  createdAt: string;
  inPlaylist: boolean;
  streamUrl: string;
}

export interface PlaylistItem {
  id: number;
  position: number;
  media: { id: number; title: string; kind: MediaKind; durationSeconds: number };
}

export interface NowPlaying {
  live: boolean;
  source: StationSource;
  serverTime: string;
  /** Set when the station is live on AzuraCast; `current` is then null. */
  stream: {
    stationName: string;
    title: string;
    artist: string;
    liveDj: string | null;
    elapsedSeconds: number;
    durationSeconds: number;
    streamUrl: string;
    artUrl: string | null;
  } | null;
  /** True when AzuraCast couldn't be reached; the player retries on the next poll. */
  unavailable?: boolean;
  current: {
    itemId: number;
    mediaId: number;
    title: string;
    kind: MediaKind;
    mimeType: string;
    durationSeconds: number;
    offsetSeconds: number;
    streamUrl: string;
  } | null;
  upNext: { title: string; kind: MediaKind; durationSeconds: number }[];
}

/** The server's `{ error }` message for a failed request, or a generic fallback. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: unknown } | null;
    if (typeof data?.error === "string") return data.error;
  }
  return fallback;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

// --- auth
export const login = (body: { email: string; password: string }) =>
  customFetch<PendingSignIn>("/api/auth/login", json("POST", body));
export const register = (body: { name: string; email: string; password: string }) =>
  customFetch<PendingSignIn>("/api/auth/register", json("POST", body));
export const setup2FA = (pendingToken: string) =>
  customFetch<{ qrDataUrl: string; secret: string }>("/api/auth/2fa/setup", json("POST", { pendingToken }));
export const enable2FA = (pendingToken: string, code: string) =>
  customFetch<Session>("/api/auth/2fa/enable", json("POST", { pendingToken, code }));
export const verify2FA = (pendingToken: string, code: string) =>
  customFetch<Session>("/api/auth/2fa/verify", json("POST", { pendingToken, code }));
export const getMe = (options?: RequestInit) =>
  customFetch<User>("/api/auth/me", { ...options, method: "GET" });
export const logoutSession = () => customFetch<{ success: boolean }>("/api/auth/logout", json("POST"));

// --- dashboard
export const getDashboardSummary = () => customFetch<DashboardSummary>("/api/dashboard/summary");


// --- listeners
export const listListeners = () => customFetch<User[]>("/api/admin/listeners");
export const setListenerActive = (id: number, isActive: boolean) =>
  customFetch<User>(`/api/admin/listeners/${id}`, json("PATCH", { isActive }));
export const resetListener2FA = (id: number) => customFetch<User>(`/api/admin/listeners/${id}/reset-2fa`, json("POST"));
export const approveListener = (id: number) => customFetch<User>(`/api/admin/listeners/${id}/approve`, json("POST"));
export const declineListener = (id: number) => customFetch<User>(`/api/admin/listeners/${id}/decline`, json("POST"));

// --- admin team (super admin only)
export const listAdmins = () => customFetch<User[]>("/api/admin/team");
export const promoteAdmin = (userId: number, permissions: Permission[]) =>
  customFetch<User>("/api/admin/team", json("POST", { userId, permissions }));
export const updateAdminPermissions = (id: number, permissions: Permission[]) =>
  customFetch<User>(`/api/admin/team/${id}`, json("PATCH", { permissions }));
export const removeAdmin = (id: number) => customFetch<User>(`/api/admin/team/${id}`, json("DELETE"));

// --- media library
export const listMedia = () => customFetch<MediaFile[]>("/api/admin/media");
export const renameMedia = (id: number, title: string) => customFetch<MediaFile>(`/api/admin/media/${id}`, json("PATCH", { title }));
export const deleteMedia = (id: number) => customFetch<{ success: boolean }>(`/api/admin/media/${id}`, json("DELETE"));

/** Uploads with XHR (not fetch) so large videos can report progress. */
export function uploadMedia(
  input: { file: File; title: string; durationSeconds: number },
  onProgress: (fraction: number) => void,
): Promise<MediaFile> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("title", input.title);
    form.append("durationSeconds", String(input.durationSeconds));
    form.append("file", input.file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", resolveApiUrl("/api/admin/media"));
    const token = localStorage.getItem("token");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      let body: any = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error(body?.error ?? "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
    xhr.send(form);
  });
}

// --- playlist + station
export const listPlaylist = () => customFetch<PlaylistItem[]>("/api/admin/playlist");
export const addToPlaylist = (mediaId: number) => customFetch<PlaylistItem>("/api/admin/playlist", json("POST", { mediaId }));
export const removeFromPlaylist = (id: number) => customFetch<{ success: boolean }>(`/api/admin/playlist/${id}`, json("DELETE"));
export const reorderPlaylist = (itemIds: number[]) =>
  customFetch<PlaylistItem[]>("/api/admin/playlist/order", json("PUT", { itemIds }));
export const getStationStatus = () => customFetch<StationStatus>("/api/admin/station");
export const startStation = () => customFetch<StationStatus>("/api/admin/station/start", json("POST"));
export const stopStation = () => customFetch<StationStatus>("/api/admin/station/stop", json("POST"));
export const setStationSource = (source: StationSource) =>
  customFetch<StationStatus>("/api/admin/station/source", json("PUT", { source }));
export const getNowPlaying = () => customFetch<NowPlaying>("/api/station/now-playing");

// --- integrations
export interface AzuraCastConnection {
  connected: boolean;
  baseUrl: string | null;
  station: string | null;
  hasApiKey: boolean;
  preview?: { stationName: string; title: string; artist: string };
}
export const getAzuraCast = () => customFetch<AzuraCastConnection>("/api/admin/integrations/azuracast");
/** Leave `apiKey` undefined to keep the stored key; pass "" to remove it. */
export const saveAzuraCast = (body: { baseUrl: string; station: string; apiKey?: string }) =>
  customFetch<AzuraCastConnection>("/api/admin/integrations/azuracast", json("PUT", body));
export const disconnectAzuraCast = () => customFetch<AzuraCastConnection>("/api/admin/integrations/azuracast", json("DELETE"));
