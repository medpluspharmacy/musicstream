import { Op } from "sequelize";
import { MediaFile, Playlist, PlaylistItem, PlaylistSchedule, sequelize } from "../models/index.js";
import { HttpError } from "../lib/http-error.js";
import { DEFAULT_DAY, isValidTimeZone, zoned } from "../lib/station-clock.js";
import StationController from "./StationController.js";

const MAX_QUEUE = 20;

function cleanName(input: unknown) {
  const name = typeof input === "string" ? input.trim() : "";
  if (!name || name.length > 80) throw new HttpError(400, "Enter a playlist name of up to 80 characters");
  return name;
}

/** Named playlists and the weekly schedule of which ones play each day. */
export default class PlaylistController {
  static async list() {
    const [playlists, items, rows] = await Promise.all([
      Playlist.findAll({ order: [["id", "ASC"]] }),
      PlaylistItem.findAll({ include: [{ model: MediaFile, as: "media", attributes: ["durationSeconds"] }], attributes: ["id", "playlistId"] }),
      PlaylistSchedule.findAll({ attributes: ["day", "playlistId"] }),
    ]);
    return playlists.map(p => {
      const own = items.filter(i => i.playlistId === p.id);
      return {
        id: p.id,
        name: p.name,
        itemCount: own.length,
        totalDurationSeconds: own.reduce((sum, i) => sum + ((i as any).media?.durationSeconds ?? 0), 0),
        scheduledDays: [...new Set(rows.filter(r => r.playlistId === p.id).map(r => r.day))].sort(),
      };
    });
  }

  static async find(id: number) {
    const p = await Playlist.findByPk(id);
    if (!p) throw new HttpError(404, "Playlist not found");
    return p;
  }

  static async create(input: { name?: unknown }) {
    const p = await Playlist.create({ name: cleanName(input.name) });
    return { id: p.id, name: p.name, itemCount: 0, totalDurationSeconds: 0, scheduledDays: [] };
  }

  static async rename(id: number, input: { name?: unknown }) {
    const p = await PlaylistController.find(id);
    p.name = cleanName(input.name);
    await p.save();
    return { id: p.id, name: p.name };
  }

  /** Deletes a playlist, its items and its places in the schedule. The last playlist can't be deleted. */
  static async remove(id: number) {
    await PlaylistController.find(id);
    if ((await Playlist.count()) <= 1) throw new HttpError(400, "Keep at least one playlist");
    await StationController.mutate(() => Playlist.destroy({ where: { id } }));
    return { success: true };
  }

  static async schedule() {
    const [rows, status] = await Promise.all([
      PlaylistSchedule.findAll({ order: [["day", "ASC"], ["position", "ASC"], ["id", "ASC"]] }),
      StationController.status(),
    ]);
    const days: Record<string, number[]> = {};
    for (let d = 0; d <= DEFAULT_DAY; d++) days[d] = rows.filter(r => r.day === d).map(r => r.playlistId);
    return { timezone: status.timezone, today: status.today, days };
  }

  /**
   * Replaces the schedule. `days` maps 0 (Sunday) to 6 (Saturday), and 7 for
   * the default queue, to playlist ids in play order; a missing or empty day
   * uses the default queue. A live station carries on with the item playing.
   */
  static async saveSchedule(input: { timezone?: unknown; days?: unknown }) {
    const timezone = input.timezone === undefined ? undefined : input.timezone;
    if (timezone !== undefined && !isValidTimeZone(timezone)) throw new HttpError(400, "Choose a valid time zone");
    if (!input.days || typeof input.days !== "object" || Array.isArray(input.days)) throw new HttpError(400, "days must map each day to a list of playlist ids");
    const entries: { day: number; position: number; playlistId: number }[] = [];
    const ids = new Set<number>();
    for (const [key, list] of Object.entries(input.days as Record<string, unknown>)) {
      const day = Number(key);
      if (!Number.isInteger(day) || day < 0 || day > DEFAULT_DAY || String(day) !== key) throw new HttpError(400, `Unknown day "${key}"`);
      if (!Array.isArray(list) || !list.every(n => Number.isSafeInteger(n) && n > 0)) throw new HttpError(400, "Each day needs a list of playlist ids");
      if (list.length > MAX_QUEUE) throw new HttpError(400, `Queue up to ${MAX_QUEUE} playlists a day`);
      list.forEach((playlistId: number, position) => { entries.push({ day, position, playlistId }); ids.add(playlistId); });
    }
    if (ids.size && (await Playlist.count({ where: { id: { [Op.in]: [...ids] } } })) !== ids.size) throw new HttpError(400, "A scheduled playlist doesn't exist");

    await StationController.mutate(() => sequelize.transaction(async (transaction) => {
      await PlaylistSchedule.destroy({ where: {}, transaction });
      if (entries.length) await PlaylistSchedule.bulkCreate(entries, { transaction });
      if (timezone !== undefined) {
        const state = await StationController.state();
        state.timezone = timezone as string;
        state.updatedAt = new Date();
        await state.save({ transaction });
      }
    }));
    return PlaylistController.schedule();
  }

  /** The station's local date and weekday right now. */
  static async today() {
    const state = await StationController.state();
    return zoned(Date.now(), state.timezone);
  }
}
