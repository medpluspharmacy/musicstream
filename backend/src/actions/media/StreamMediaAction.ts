import { Request, Response } from "express";
import { verifyMediaToken } from "../../middlewares/auth.js";
import MediaController from "../../controllers/MediaController.js";
import { storage } from "../../lib/storage.js";
import { sendError } from "../../lib/http-error.js";
import { parseId } from "../../lib/params.js";

/** Streams a media file with HTTP Range support so players can seek. Auth is the signed `t` query token. */
export class StreamMediaAction {
  static async handle(req: Request, res: Response) {
    try {
      const id = parseId(req.params.id);
      if (!id || !verifyMediaToken(req.query.t, id)) { res.status(403).json({ error: "Forbidden" }); return; }
      const found = await MediaController.openForStreaming(id);
      if (!found) { res.status(404).json({ error: "Media not found" }); return; }
      const { media, size } = found;

      res.setHeader("Content-Type", media.mimeType);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "private, max-age=3600");

      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
      if (!match || (!match[1] && !match[2])) {
        res.setHeader("Content-Length", size);
        storage.createReadStream(media.storageKey!).pipe(res);
        return;
      }
      let start: number;
      let end: number;
      if (match[1]) {
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      } else {
        // Suffix range: the last N bytes.
        start = Math.max(size - Number(match[2]), 0);
        end = size - 1;
      }
      if (start > end || start >= size) {
        res.status(416).setHeader("Content-Range", `bytes */${size}`).end();
        return;
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Content-Length", end - start + 1);
      storage.createReadStream(media.storageKey!, { start, end }).pipe(res);
    } catch (err) {
      sendError(res, err, "GET /media/:id/stream");
    }
  }
}
