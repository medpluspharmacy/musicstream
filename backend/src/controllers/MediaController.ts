import path from "node:path";
import fsp from "node:fs/promises";
import { MediaFile, PlaylistItem } from "../models/index.js";
import { storage } from "../lib/storage.js";
import { HttpError } from "../lib/http-error.js";
import StationController, { mediaStreamUrl } from "./StationController.js";

const MAX_DURATION_SECONDS = 24 * 60 * 60;

export interface UploadedFile {
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
}

function kindFor(mimeType: string): "audio" | "video" | null {
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

export default class MediaController {
  static async listAll() {
    const [media, playlist] = await Promise.all([
      MediaFile.findAll({ order: [["createdAt", "DESC"]] }),
      PlaylistItem.findAll({ attributes: ["mediaId"] }),
    ]);
    const inPlaylist = new Set(playlist.map(p => p.mediaId));
    return media.map(m => ({
      id: m.id,
      title: m.title,
      kind: m.kind,
      provider: m.provider,
      mimeType: m.mimeType,
      sizeBytes: m.sizeBytes,
      durationSeconds: m.durationSeconds,
      originalName: m.originalName,
      createdAt: m.createdAt,
      inPlaylist: inPlaylist.has(m.id),
      streamUrl: mediaStreamUrl(m.id),
    }));
  }

  static async create(file: UploadedFile, rawTitle: unknown, rawDuration: unknown, uploadedById: number) {
    try {
      const kind = kindFor(file.mimetype);
      if (!kind) throw new HttpError(400, "Only audio and video files can be uploaded");
      const durationSeconds = Number(rawDuration);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_DURATION_SECONDS) {
        throw new HttpError(400, "Could not read the media duration. Check the file plays in your browser.");
      }
      const ext = path.extname(file.originalname).toLowerCase();
      const title = (typeof rawTitle === "string" && rawTitle.trim())
        || path.basename(file.originalname, path.extname(file.originalname));
      const storageKey = await storage.saveFromPath(file.path, ext);
      return await MediaFile.create({
        title,
        kind,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        durationSeconds,
        storageKey,
        originalName: file.originalname,
        uploadedById,
      });
    } finally {
      // No-op once the file has been moved into storage.
      await fsp.rm(file.path, { force: true });
    }
  }

  static async rename(id: number, title: string) {
    const media = await MediaFile.findByPk(id);
    if (!media) return null;
    media.title = title.trim();
    await media.save();
    return media;
  }

  static async delete(id: number) {
    const media = await MediaFile.findByPk(id);
    if (!media) return null;
    // Playlist rows cascade; re-anchor the station around the removal.
    await StationController.mutate(() => media.destroy());
    if (media.storageKey) await storage.remove(media.storageKey);
    return true;
  }

  static async openForStreaming(id: number) {
    const media = await MediaFile.findByPk(id);
    if (!media?.storageKey) return null;
    return { media, size: await storage.size(media.storageKey) };
  }
}
