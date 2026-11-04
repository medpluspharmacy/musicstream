import { HttpError } from "./http-error.js";

/**
 * Minimal AzuraCast client (https://www.azuracast.com/docs/developers/apis/).
 * Only reads the public "now playing" endpoint; the audio itself is proxied by
 * StreamLiveAction so listeners never see the AzuraCast address.
 */

export interface AzuraCastConfig {
  baseUrl: string;
  station: string;
  apiKey: string | null;
}

export interface AzuraCastNowPlaying {
  stationName: string;
  listenUrl: string;
  liveDj: string | null;
  title: string;
  artist: string;
  artUrl: string | null;
  elapsedSeconds: number;
  durationSeconds: number;
  next: { title: string; artist: string; durationSeconds: number } | null;
}

const TIMEOUT_MS = 8_000;
const CACHE_MS = 10_000;
const STATION_RE = /^[A-Za-z0-9_-]{1,100}$/;

/** `https://radio.example.com/` → `https://radio.example.com`. Rejects anything that isn't a plain http(s) URL. */
export function normalizeBaseUrl(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) throw new HttpError(400, "AzuraCast URL is required");
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new HttpError(400, "Enter the full AzuraCast address, e.g. https://radio.example.com");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new HttpError(400, "AzuraCast URL must start with http:// or https://");
  if (url.username || url.password) throw new HttpError(400, "Don't put credentials in the URL; use the API key field");
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export function normalizeStation(input: unknown): string {
  const s = typeof input === "string" ? input.trim() : "";
  if (!STATION_RE.test(s)) throw new HttpError(400, "Station must be the AzuraCast station short name (letters, numbers, _ or -)");
  return s;
}

/** True when `url` points at the same host as the configured AzuraCast server (any port). */
export function isSameHost(url: string, baseUrl: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname === new URL(baseUrl).hostname;
  } catch {
    return false;
  }
}

/** fetch with a timeout and no redirects, so a configured host can't bounce requests elsewhere. */
export async function fetchFromAzuraCast(url: string, init: { apiKey?: string | null; signal?: AbortSignal; timeoutMs?: number } = {}) {
  const ctrl = new AbortController();
  const timer = init.timeoutMs === 0 ? null : setTimeout(() => ctrl.abort(), init.timeoutMs ?? TIMEOUT_MS);
  init.signal?.addEventListener("abort", () => ctrl.abort());
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: ctrl.signal,
      headers: init.apiKey ? { "X-API-Key": init.apiKey } : {},
    });
    return { res, clearTimeout: () => timer && clearTimeout(timer) };
  } catch {
    if (timer) clearTimeout(timer);
    throw new HttpError(502, "Couldn't reach the AzuraCast server");
  }
}

const cache = new Map<string, { at: number; data: Promise<AzuraCastNowPlaying> }>();

export function clearAzuraCastCache() {
  cache.clear();
}

export function getNowPlaying(cfg: AzuraCastConfig, { fresh = false } = {}): Promise<AzuraCastNowPlaying> {
  const key = `${cfg.baseUrl}|${cfg.station}|${cfg.apiKey ?? ""}`;
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const data = loadNowPlaying(cfg);
  cache.set(key, { at: Date.now(), data });
  data.catch(() => cache.delete(key));
  return data;
}

async function loadNowPlaying(cfg: AzuraCastConfig): Promise<AzuraCastNowPlaying> {
  const { res, clearTimeout } = await fetchFromAzuraCast(`${cfg.baseUrl}/api/nowplaying/${encodeURIComponent(cfg.station)}`, { apiKey: cfg.apiKey });
  try {
    if (res.status >= 300 && res.status < 400) throw new HttpError(502, "AzuraCast redirected the request; use the final address (usually https://)");
    if (res.status === 401 || res.status === 403) throw new HttpError(502, "AzuraCast refused access; check the API key");
    if (res.status === 404) throw new HttpError(502, "That station wasn't found on the AzuraCast server");
    if (!res.ok) throw new HttpError(502, `AzuraCast responded with HTTP ${res.status}`);
    let body: any;
    try {
      body = await res.json();
    } catch {
      throw new HttpError(502, "That address didn't return AzuraCast data");
    }
    return parseNowPlaying(body, cfg.baseUrl);
  } finally {
    clearTimeout();
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

export function parseNowPlaying(body: any, baseUrl: string): AzuraCastNowPlaying {
  const station = body?.station;
  if (!station || typeof station !== "object") throw new HttpError(502, "That address didn't return AzuraCast data");
  const mounts: any[] = Array.isArray(station.mounts) ? station.mounts : [];
  const listenUrl = str(mounts.find(m => m?.is_default)?.url) || str(station.listen_url);
  if (!listenUrl) throw new HttpError(502, "The AzuraCast station has no stream to play");
  if (!isSameHost(listenUrl, baseUrl)) {
    throw new HttpError(502, "The station's stream is on a different host than the AzuraCast URL; use that host instead");
  }
  const np = body.now_playing ?? {};
  const song = np.song ?? {};
  const nextSong = body.playing_next?.song;
  const art = str(song.art);
  return {
    stationName: str(station.name) || "AzuraCast",
    listenUrl,
    liveDj: body.live?.is_live ? str(body.live.streamer_name) || "Live DJ" : null,
    title: str(song.title) || str(song.text) || "Live",
    artist: str(song.artist),
    artUrl: art && isSameHost(art, baseUrl) ? art : null,
    elapsedSeconds: num(np.elapsed),
    durationSeconds: num(np.duration),
    next: nextSong ? { title: str(nextSong.title) || str(nextSong.text), artist: str(nextSong.artist), durationSeconds: num(body.playing_next.duration) } : null,
  };
}
