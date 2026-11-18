import { MediaFile, Playlist, PlaylistItem, PlaylistSchedule, StationState, User, sequelize } from "../models/index.js";
import type { StationSource } from "../models/StationState.js";
import { generateLiveToken, generateMediaToken } from "../middlewares/auth.js";
import { HttpError } from "../lib/http-error.js";
import { decryptSecret } from "../lib/secret-cipher.js";
import { getNowPlaying as getAzuraCastNowPlaying, type AzuraCastConfig } from "../lib/azuracast.js";
import { logger } from "../lib/logger.js";
import { DEFAULT_DAY, zoned } from "../lib/station-clock.js";

const UP_NEXT_COUNT = 5;
export const MAX_CROSSFADE_SECONDS = 12;
// Days to look back when working out today's start; the anchor is moved forward
// as days pass, so this is only reached after a long time without listeners.
const MAX_DAYS_BACK = 400;

type LoadedItem = PlaylistItem & { media: MediaFile };

/** One entry in a day's programme: a playlist item, with the playlist it came from. */
export interface Slot {
  id: number;
  media: MediaFile;
  playlistId: number;
  playlistName: string;
}

type Programmes = (weekday: number) => Slot[];

export function mediaStreamUrl(mediaId: number) {
  return `/api/media/${mediaId}/stream?t=${encodeURIComponent(generateMediaToken(mediaId))}`;
}

function totalDuration(items: { media: MediaFile }[]) {
  return items.reduce((sum, i) => sum + i.media.durationSeconds, 0);
}

/**
 * Seconds that item i overlaps the next one. Capped at half of either item, so
 * a short jingle never fades for longer than it plays. A one-item loop doesn't
 * crossfade into itself.
 */
function overlapAfter(items: { media: MediaFile }[], i: number, crossfade: number) {
  if (items.length < 2 || crossfade <= 0) return 0;
  const a = items[i].media.durationSeconds;
  const b = items[(i + 1) % items.length].media.durationSeconds;
  return Math.max(0, Math.min(crossfade, a / 2, b / 2));
}

/**
 * The loop's schedule: item i starts at starts[i] and plays its full duration,
 * but the next item starts `overlap` seconds before it ends. Without crossfade
 * this is just the durations end to end.
 */
export function timeline(items: { media: MediaFile }[], crossfade: number) {
  const starts: number[] = [];
  const overlaps: number[] = [];
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    starts.push(total);
    overlaps.push(overlapAfter(items, i, crossfade));
    total += items[i].media.durationSeconds - overlaps[i];
  }
  return { starts, overlaps, total };
}

/**
 * Loads every playlist and the weekly schedule, and returns each weekday's
 * programme: its queue of playlists (or the default queue) laid end to end.
 */
async function loadProgrammes(): Promise<Programmes> {
  const [rows, playlists, items] = await Promise.all([
    PlaylistSchedule.findAll({ order: [["day", "ASC"], ["position", "ASC"], ["id", "ASC"]] }),
    Playlist.findAll({ attributes: ["id", "name"] }),
    PlaylistItem.findAll({ include: [{ model: MediaFile, as: "media" }], order: [["position", "ASC"], ["id", "ASC"]] }),
  ]);
  const names = new Map(playlists.map(p => [p.id, p.name]));
  const byPlaylist = new Map<number, LoadedItem[]>();
  for (const it of items as LoadedItem[]) {
    if (!it.media) continue;
    const list = byPlaylist.get(it.playlistId) ?? [];
    list.push(it);
    byPlaylist.set(it.playlistId, list);
  }
  const queues = new Map<number, number[]>();
  for (const r of rows) queues.set(r.day, [...(queues.get(r.day) ?? []), r.playlistId]);
  const cache = new Map<number, Slot[]>();
  return (weekday: number) => {
    let slots = cache.get(weekday);
    if (!slots) {
      const own = queues.get(weekday);
      const queue = own && own.length ? own : queues.get(DEFAULT_DAY) ?? [];
      slots = queue.flatMap(pid => (byPlaylist.get(pid) ?? []).map(it => ({
        id: it.id, media: it.media, playlistId: pid, playlistName: names.get(pid) ?? "",
      })));
      cache.set(weekday, slots);
    }
    return slots;
  };
}

/**
 * The universal station plays either the playlist schedule or a connected
 * AzuraCast station. Each day plays that day's programme as a loop, anchored
 * at the moment it started (station_state.started_at for station_state.anchor_day),
 * so every listener derives the same position from the clock alone. When the
 * day changes, the item playing at midnight finishes, then the new day's
 * programme starts from the top. AzuraCast is a live stream that is already in sync.
 */
export default class StationController {
  static async state() {
    const [state] = await StationState.findOrCreate({ where: { id: 1 } });
    return state;
  }

  static azuracastConfig(state: StationState): AzuraCastConfig | null {
    if (!state.azuracastUrl || !state.azuracastStation) return null;
    return {
      baseUrl: state.azuracastUrl,
      station: state.azuracastStation,
      apiKey: state.azuracastApiKey ? decryptSecret(state.azuracastApiKey) : null,
    };
  }

  /** The AzuraCast station to proxy, or null when the station isn't live on AzuraCast. */
  static async liveStreamTarget() {
    const state = await StationController.state();
    const cfg = StationController.azuracastConfig(state);
    if (!state.isLive || state.source !== "azuracast" || !cfg) return null;
    return { cfg, nowPlaying: await getAzuraCastNowPlaying(cfg) };
  }

  /**
   * Where a loop is at `now`: the item that most recently started, seconds
   * into it, how long it fades in and out, and when the next item starts.
   * During a crossfade the incoming item is the current one.
   */
  static locate(items: { media: MediaFile }[], anchorMs: number, now: number, crossfade = 0) {
    const { starts, overlaps, total } = timeline(items, crossfade);
    if (items.length === 0 || total <= 0) return null;
    let pos = ((now - anchorMs) / 1000) % total;
    if (pos < 0) pos += total;
    let index = items.length - 1;
    for (let i = 0; i < items.length; i++) {
      if (pos < starts[i] + items[i].media.durationSeconds - overlaps[i]) { index = i; break; }
    }
    const offset = Math.max(0, pos - starts[index]);
    const slot = items[index].media.durationSeconds - overlaps[index];
    return {
      index,
      offset,
      fadeInSeconds: overlaps[(index - 1 + items.length) % items.length],
      fadeOutSeconds: overlaps[index],
      nextStartsInSeconds: Math.max(0, slot - offset),
    };
  }

  /**
   * When a day's programme started: the anchor itself on the anchor day, and on
   * later days, when the item playing at midnight finished.
   */
  private static dayAnchor(state: StationState, prog: Programmes, day: ReturnType<typeof zoned>, depth = 0): number | null {
    if (!state.startedAt) return null;
    const anchorDay = state.anchorDay ?? zoned(state.startedAt.getTime(), state.timezone).key;
    if (day.key === anchorDay) return state.startedAt.getTime();
    if (day.key < anchorDay) return null;
    if (depth > MAX_DAYS_BACK) return day.dayStart;
    const prev = zoned(day.dayStart - 1, state.timezone);
    const prevAnchor = StationController.dayAnchor(state, prog, prev, depth + 1);
    if (prevAnchor === null) return day.dayStart;
    const loc = StationController.locate(prog(prev.weekday), prevAnchor, day.dayStart, state.crossfadeSeconds);
    return loc ? day.dayStart + loc.nextStartsInSeconds * 1000 : day.dayStart;
  }

  /** What's playing at `t`: the day's programme, its anchor, and the position in it. */
  static at(state: StationState, prog: Programmes, t: number) {
    if (!state.isLive || !state.startedAt) return null;
    const day = zoned(t, state.timezone);
    const anchor = StationController.dayAnchor(state, prog, day);
    if (anchor === null) return null;
    if (t < anchor) {
      // Still finishing the item that was playing at midnight.
      const prev = zoned(day.dayStart - 1, state.timezone);
      const prevAnchor = StationController.dayAnchor(state, prog, prev);
      if (prevAnchor !== null) {
        const slots = prog(prev.weekday);
        const loc = StationController.locate(slots, prevAnchor, t, state.crossfadeSeconds);
        return { slots, loc, anchor: prevAnchor, dayKey: prev.key, carryOver: true };
      }
    }
    const slots = prog(day.weekday);
    return { slots, loc: StationController.locate(slots, anchor, t, state.crossfadeSeconds), anchor, dayKey: day.key, carryOver: false };
  }

  /**
   * Runs a playlist, schedule or playback change, then re-anchors today's
   * programme so whatever is playing keeps playing at the same point. If it was
   * removed, today's programme restarts from the top.
   */
  static async mutate<T>(change: () => Promise<T>): Promise<T> {
    const [stateBefore, progBefore] = await Promise.all([StationController.state(), loadProgrammes()]);
    const now = Date.now();
    const before = StationController.at(stateBefore, progBefore, now);
    const result = await change();
    const state = await StationController.state();
    if (state.isLive && !before?.carryOver) {
      const prog = await loadProgrammes();
      const today = zoned(now, state.timezone);
      const slots = prog(today.weekday);
      let startedAt = now;
      if (before?.loc) {
        // The same entry: the n-th time this item appears, in case a playlist is queued twice.
        const id = before.slots[before.loc.index].id;
        const nth = before.slots.slice(0, before.loc.index).filter(s => s.id === id).length;
        const matches = slots.flatMap((s, i) => (s.id === id ? [i] : []));
        const idx = matches[Math.min(nth, matches.length - 1)] ?? -1;
        if (idx >= 0) startedAt = now - (timeline(slots, state.crossfadeSeconds).starts[idx] + before.loc.offset) * 1000;
      }
      state.startedAt = new Date(startedAt);
      state.anchorDay = today.key;
      state.updatedAt = new Date();
      await state.save();
    }
    return result;
  }

  private static nowItem(slot: Slot) {
    return {
      itemId: slot.id,
      mediaId: slot.media.id,
      title: slot.media.title,
      kind: slot.media.kind,
      mimeType: slot.media.mimeType,
      durationSeconds: slot.media.durationSeconds,
      streamUrl: mediaStreamUrl(slot.media.id),
      playlistName: slot.playlistName,
    };
  }

  static async nowPlaying(viewer: { id: number }) {
    const state = await StationController.state();
    if (state.source === "azuracast") return StationController.azuracastNowPlaying(state, viewer);
    const now = Date.now();
    const base = { live: state.isLive, source: state.source, serverTime: new Date(now).toISOString(), stream: null, gapless: state.gapless };
    const prog = await loadProgrammes();
    const pos = StationController.at(state, prog, now);
    if (!pos?.loc) return { ...base, current: null, next: null, upNext: [] };

    // Move the anchor forward to today, so later days don't recompute from an old one.
    if (!pos.carryOver && pos.dayKey !== state.anchorDay) {
      state.startedAt = new Date(pos.anchor);
      state.anchorDay = pos.dayKey;
      await state.save();
    }

    const slot = pos.slots[pos.loc.index];
    // What follows, even across midnight into the next day's programme.
    const following: Slot[] = [];
    let t = now + pos.loc.nextStartsInSeconds * 1000;
    const count = Math.min(UP_NEXT_COUNT, Math.max(1, pos.slots.length - 1));
    for (let k = 0; k < count; k++) {
      const q = StationController.at(state, prog, t + 1);
      if (!q?.loc) break;
      following.push(q.slots[q.loc.index]);
      t = t + 1 + q.loc.nextStartsInSeconds * 1000;
    }
    return {
      ...base,
      current: {
        ...StationController.nowItem(slot),
        offsetSeconds: pos.loc.offset,
        fadeInSeconds: pos.loc.fadeInSeconds,
        fadeOutSeconds: pos.loc.fadeOutSeconds,
        nextStartsInSeconds: pos.loc.nextStartsInSeconds,
      },
      // Lets players load the next item early, for gapless playback and crossfades.
      next: following[0] ? StationController.nowItem(following[0]) : null,
      upNext: (pos.slots.length > 1 ? following : []).map(s => ({ title: s.media.title, kind: s.media.kind, durationSeconds: s.media.durationSeconds })),
    };
  }

  private static async azuracastNowPlaying(state: StationState, viewer: { id: number }) {
    const base = { live: state.isLive, source: state.source, serverTime: new Date().toISOString(), current: null, next: null, gapless: state.gapless };
    const cfg = StationController.azuracastConfig(state);
    if (!state.isLive || !cfg) return { ...base, stream: null, upNext: [] };
    const user = await User.findByPk(viewer.id, { attributes: ["id", "tokenVersion"] });
    if (!user) throw new HttpError(401, "Invalid token");
    let np;
    try {
      np = await getAzuraCastNowPlaying(cfg);
    } catch (err) {
      logger.warn({ err }, "AzuraCast now-playing failed");
      return { ...base, stream: null, upNext: [], unavailable: true };
    }
    const t = encodeURIComponent(generateLiveToken(user));
    return {
      ...base,
      stream: {
        stationName: np.stationName,
        title: np.title,
        artist: np.artist,
        liveDj: np.liveDj,
        elapsedSeconds: np.elapsedSeconds,
        durationSeconds: np.durationSeconds,
        streamUrl: `/api/station/live?t=${t}`,
        artUrl: np.artUrl ? `/api/station/live/art?t=${t}` : null,
      },
      upNext: np.next
        ? [{ title: np.next.artist ? `${np.next.artist} – ${np.next.title}` : np.next.title, kind: "audio", durationSeconds: np.next.durationSeconds }]
        : [],
    };
  }

  /** The playlist the older single-playlist endpoints use: the first in the default queue. */
  static async defaultPlaylistId(): Promise<number> {
    const first = await PlaylistSchedule.findOne({ where: { day: DEFAULT_DAY }, order: [["position", "ASC"], ["id", "ASC"]] });
    if (first) return first.playlistId;
    const any = await Playlist.findOne({ order: [["id", "ASC"]] });
    if (any) return any.id;
    return (await Playlist.create({ name: "Main playlist" })).id;
  }

  static async listPlaylist(playlistId?: number) {
    const id = playlistId ?? await StationController.defaultPlaylistId();
    const items = (await PlaylistItem.findAll({
      where: { playlistId: id },
      include: [{ model: MediaFile, as: "media" }],
      order: [["position", "ASC"], ["id", "ASC"]],
    })) as LoadedItem[];
    return items.map(i => ({
      id: i.id,
      position: i.position,
      media: { id: i.media.id, title: i.media.title, kind: i.media.kind, durationSeconds: i.media.durationSeconds },
    }));
  }

  static async addItem(mediaId: number, playlistId?: number) {
    const id = playlistId ?? await StationController.defaultPlaylistId();
    const media = await MediaFile.findByPk(mediaId);
    if (!media) throw new HttpError(404, "Media not found");
    return StationController.mutate(async () => {
      const max = (await PlaylistItem.max("position", { where: { playlistId: id } })) as number | null;
      return PlaylistItem.create({ mediaId, playlistId: id, position: (max ?? -1) + 1 });
    });
  }

  /** Removes an item; with `playlistId`, only if it belongs to that playlist. */
  static async removeItem(itemId: number, playlistId?: number) {
    return StationController.mutate(async () => {
      const where = playlistId === undefined ? { id: itemId } : { id: itemId, playlistId };
      const count = await PlaylistItem.destroy({ where });
      return count === 0 ? null : true;
    });
  }

  /** `itemIds` must list every item in the playlist exactly once, in the new order. */
  static async reorder(itemIds: number[], playlistId?: number) {
    const id = playlistId ?? await StationController.defaultPlaylistId();
    const existing = (await PlaylistItem.findAll({ where: { playlistId: id }, attributes: ["id"] })).map(i => i.id);
    const same = itemIds.length === existing.length
      && new Set(itemIds).size === itemIds.length
      && itemIds.every(i => existing.includes(i));
    if (!same) throw new HttpError(400, "Order must include every playlist item exactly once");
    await StationController.mutate(() => sequelize.transaction(async (transaction) => {
      for (let i = 0; i < itemIds.length; i++) {
        await PlaylistItem.update({ position: i }, { where: { id: itemIds[i], playlistId: id }, transaction });
      }
    }));
    return StationController.listPlaylist(id);
  }

  /** Today's programme in the station's time zone, for the admin pages. */
  static async status() {
    const [state, prog] = await Promise.all([StationController.state(), loadProgrammes()]);
    const today = zoned(Date.now(), state.timezone);
    const slots = prog(today.weekday);
    const playlists: { id: number; name: string }[] = [];
    for (const s of slots) if (playlists[playlists.length - 1]?.id !== s.playlistId) playlists.push({ id: s.playlistId, name: s.playlistName });
    return {
      live: state.isLive,
      startedAt: state.startedAt,
      source: state.source,
      azuracastStation: state.azuracastUrl ? state.azuracastStation : null,
      itemCount: slots.length,
      totalDurationSeconds: totalDuration(slots),
      today: { date: today.key, weekday: today.weekday, playlists },
      timezone: state.timezone,
      playback: { crossfadeSeconds: state.crossfadeSeconds, gapless: state.gapless },
    };
  }

  /** Changes how the playlist plays. A live station carries on from the same point in the current item. */
  static async setPlayback(input: { crossfadeSeconds: number; gapless: boolean }) {
    await StationController.mutate(async () => {
      const state = await StationController.state();
      state.crossfadeSeconds = input.crossfadeSeconds;
      state.gapless = input.gapless;
      state.updatedAt = new Date();
      await state.save();
    });
    return StationController.status();
  }

  /** Starts today's programme from the top, now. */
  private static anchorNow(state: StationState) {
    const now = Date.now();
    state.startedAt = new Date(now);
    state.anchorDay = zoned(now, state.timezone).key;
  }

  /** Checks the chosen source can play right now; AzuraCast errors explain what's wrong. */
  private static async assertPlayable(state: StationState, source: StationSource) {
    if (source === "azuracast") {
      const cfg = StationController.azuracastConfig(state);
      if (!cfg) throw new HttpError(400, "Connect AzuraCast on the Integrations page first");
      await getAzuraCastNowPlaying(cfg, { fresh: true });
    } else {
      const prog = await loadProgrammes();
      if (prog(zoned(Date.now(), state.timezone).weekday).length === 0) {
        throw new HttpError(400, "Nothing is scheduled for today. Add a playlist with media to today's queue, or to the default queue, on the Playlists page.");
      }
    }
  }

  /** Switches what the station plays. While live, listeners move over on their next poll. */
  static async setSource(source: StationSource) {
    const state = await StationController.state();
    if (state.source !== source) {
      if (state.isLive) await StationController.assertPlayable(state, source);
      else if (source === "azuracast" && !StationController.azuracastConfig(state)) {
        throw new HttpError(400, "Connect AzuraCast on the Integrations page first");
      }
      state.source = source;
      if (state.isLive) StationController.anchorNow(state);
      state.updatedAt = new Date();
      await state.save();
    }
    return StationController.status();
  }

  static async start() {
    const state = await StationController.state();
    if (!state.isLive) {
      await StationController.assertPlayable(state, state.source);
      state.isLive = true;
      StationController.anchorNow(state);
      state.updatedAt = new Date();
      await state.save();
    }
    return StationController.status();
  }

  static async stop() {
    const state = await StationController.state();
    state.isLive = false;
    state.startedAt = null;
    state.anchorDay = null;
    state.updatedAt = new Date();
    await state.save();
    return StationController.status();
  }
}
