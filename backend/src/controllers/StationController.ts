import { MediaFile, PlaylistItem, StationState, User, sequelize } from "../models/index.js";
import type { StationSource } from "../models/StationState.js";
import { generateLiveToken, generateMediaToken } from "../middlewares/auth.js";
import { HttpError } from "../lib/http-error.js";
import { decryptSecret } from "../lib/secret-cipher.js";
import { getNowPlaying as getAzuraCastNowPlaying, type AzuraCastConfig } from "../lib/azuracast.js";
import { logger } from "../lib/logger.js";

const UP_NEXT_COUNT = 5;

type LoadedItem = PlaylistItem & { media: MediaFile };

export function mediaStreamUrl(mediaId: number) {
  return `/api/media/${mediaId}/stream?t=${encodeURIComponent(generateMediaToken(mediaId))}`;
}

function totalDuration(items: LoadedItem[]) {
  return items.reduce((sum, i) => sum + i.media.durationSeconds, 0);
}

/**
 * The universal station plays either the uploaded playlist or a connected
 * AzuraCast station. The playlist is an endless loop anchored at
 * station_state.started_at, so every listener derives the same position from
 * the clock alone; AzuraCast is a live stream that is already in sync.
 */
export default class StationController {
  static async items(): Promise<LoadedItem[]> {
    return (await PlaylistItem.findAll({
      include: [{ model: MediaFile, as: "media" }],
      order: [["position", "ASC"], ["id", "ASC"]],
    })) as LoadedItem[];
  }

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

  /** Where the loop is at `now`: the item index and seconds into that item. */
  static locate(items: LoadedItem[], startedAt: Date, now: number) {
    const total = totalDuration(items);
    if (items.length === 0 || total <= 0) return null;
    let pos = ((now - startedAt.getTime()) / 1000) % total;
    if (pos < 0) pos += total;
    for (let i = 0; i < items.length; i++) {
      const d = items[i].media.durationSeconds;
      if (pos < d) return { index: i, offset: pos };
      pos -= d;
    }
    return { index: items.length - 1, offset: 0 };
  }

  private static async currentPosition() {
    const [state, items] = await Promise.all([StationController.state(), StationController.items()]);
    if (!state.isLive || !state.startedAt) return null;
    const loc = StationController.locate(items, state.startedAt, Date.now());
    return loc ? { itemId: items[loc.index].id, offset: loc.offset } : null;
  }

  /**
   * Runs a playlist change, then re-anchors the loop so whatever is playing
   * keeps playing at the same point instead of jumping. If the playing item
   * was removed, the loop restarts from the top.
   */
  static async mutate<T>(change: () => Promise<T>): Promise<T> {
    const before = await StationController.currentPosition();
    const result = await change();
    const state = await StationController.state();
    if (state.isLive) {
      const items = await StationController.items();
      const now = Date.now();
      let startedAt = new Date(now);
      const idx = before ? items.findIndex(i => i.id === before.itemId) : -1;
      if (before && idx >= 0) {
        const cumulative = totalDuration(items.slice(0, idx));
        startedAt = new Date(now - (cumulative + before.offset) * 1000);
      }
      state.startedAt = startedAt;
      state.updatedAt = new Date();
      await state.save();
    }
    return result;
  }

  static async nowPlaying(viewer: { id: number }) {
    const [state, items] = await Promise.all([StationController.state(), StationController.items()]);
    if (state.source === "azuracast") return StationController.azuracastNowPlaying(state, viewer);
    const now = Date.now();
    const base = { live: state.isLive, source: state.source, serverTime: new Date(now).toISOString(), stream: null };
    const loc = state.isLive && state.startedAt ? StationController.locate(items, state.startedAt, now) : null;
    if (!loc) return { ...base, current: null, upNext: [] };

    const item = items[loc.index];
    const upNext = [];
    for (let k = 1; k <= Math.min(UP_NEXT_COUNT, items.length - 1); k++) {
      const m = items[(loc.index + k) % items.length].media;
      upNext.push({ title: m.title, kind: m.kind, durationSeconds: m.durationSeconds });
    }
    return {
      ...base,
      current: {
        itemId: item.id,
        mediaId: item.media.id,
        title: item.media.title,
        kind: item.media.kind,
        mimeType: item.media.mimeType,
        durationSeconds: item.media.durationSeconds,
        offsetSeconds: loc.offset,
        streamUrl: mediaStreamUrl(item.media.id),
      },
      upNext,
    };
  }

  private static async azuracastNowPlaying(state: StationState, viewer: { id: number }) {
    const base = { live: state.isLive, source: state.source, serverTime: new Date().toISOString(), current: null };
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

  static async listPlaylist() {
    const items = await StationController.items();
    return items.map(i => ({
      id: i.id,
      position: i.position,
      media: { id: i.media.id, title: i.media.title, kind: i.media.kind, durationSeconds: i.media.durationSeconds },
    }));
  }

  static async addItem(mediaId: number) {
    const media = await MediaFile.findByPk(mediaId);
    if (!media) throw new HttpError(404, "Media not found");
    return StationController.mutate(async () => {
      const max = (await PlaylistItem.max("position")) as number | null;
      return PlaylistItem.create({ mediaId, position: (max ?? -1) + 1 });
    });
  }

  static async removeItem(itemId: number) {
    return StationController.mutate(async () => {
      const count = await PlaylistItem.destroy({ where: { id: itemId } });
      return count === 0 ? null : true;
    });
  }

  /** `itemIds` must list every playlist item exactly once, in the new order. */
  static async reorder(itemIds: number[]) {
    const existing = (await PlaylistItem.findAll({ attributes: ["id"] })).map(i => i.id);
    const same = itemIds.length === existing.length
      && new Set(itemIds).size === itemIds.length
      && itemIds.every(id => existing.includes(id));
    if (!same) throw new HttpError(400, "Order must include every playlist item exactly once");
    await StationController.mutate(() => sequelize.transaction(async (transaction) => {
      for (let i = 0; i < itemIds.length; i++) {
        await PlaylistItem.update({ position: i }, { where: { id: itemIds[i] }, transaction });
      }
    }));
    return StationController.listPlaylist();
  }

  static async status() {
    const [state, items] = await Promise.all([StationController.state(), StationController.items()]);
    return {
      live: state.isLive,
      startedAt: state.startedAt,
      source: state.source,
      azuracastStation: state.azuracastUrl ? state.azuracastStation : null,
      itemCount: items.length,
      totalDurationSeconds: totalDuration(items),
    };
  }

  /** Checks the chosen source can play right now; AzuraCast errors explain what's wrong. */
  private static async assertPlayable(state: StationState, source: StationSource) {
    if (source === "azuracast") {
      const cfg = StationController.azuracastConfig(state);
      if (!cfg) throw new HttpError(400, "Connect AzuraCast on the Integrations page first");
      await getAzuraCastNowPlaying(cfg, { fresh: true });
    } else if ((await PlaylistItem.count()) === 0) {
      throw new HttpError(400, "Add something to the playlist first");
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
      if (state.isLive) state.startedAt = new Date();
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
      state.startedAt = new Date();
      state.updatedAt = new Date();
      await state.save();
    }
    return StationController.status();
  }

  static async stop() {
    const state = await StationController.state();
    state.isLive = false;
    state.startedAt = null;
    state.updatedAt = new Date();
    await state.save();
    return StationController.status();
  }
}
