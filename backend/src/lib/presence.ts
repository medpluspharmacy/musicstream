/**
 * Who has the Listen page open right now, from the player's regular
 * now-playing checks (every 10–15 seconds). Kept in memory: it rebuilds itself
 * within one check after a restart, and it's per server, which is why the app
 * runs as a single instance.
 */

// Long enough to ride out a missed check or a throttled background tab.
export const PRESENCE_WINDOW_MS = 75_000;

interface Presence {
  connectedSince: number;
  lastSeen: number;
  listening: boolean;
  listeningSince: number | null;
}

const seen = new Map<number, Presence>();

export function markSeen(userId: number, listening: boolean, now = Date.now()) {
  const prev = seen.get(userId);
  const fresh = !prev || now - prev.lastSeen > PRESENCE_WINDOW_MS;
  seen.set(userId, {
    connectedSince: fresh ? now : prev.connectedSince,
    lastSeen: now,
    listening,
    listeningSince: listening ? (!fresh && prev.listening ? prev.listeningSince : now) : null,
  });
}

/** Drops someone at once, e.g. when they're signed out or deactivated. */
export function forget(userId: number) {
  seen.delete(userId);
}

/** Everyone seen recently, oldest connection first. Expired entries are removed. */
export function connectedNow(now = Date.now()) {
  const out: Array<Presence & { userId: number }> = [];
  for (const [userId, p] of seen) {
    if (now - p.lastSeen > PRESENCE_WINDOW_MS) seen.delete(userId);
    else out.push({ userId, ...p });
  }
  return out.sort((a, b) => a.connectedSince - b.connectedSince);
}
