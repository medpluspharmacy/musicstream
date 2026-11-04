import { Request, Response } from "express";
import StationController from "../../controllers/StationController.js";
import { fetchFromAzuraCast } from "../../lib/azuracast.js";
import { sendError } from "../../lib/http-error.js";
import { liveListenerAllowed } from "./StreamLiveAction.js";

const MAX_ART_BYTES = 5 * 1024 * 1024;

/** Album art for the current AzuraCast track, proxied like the stream. */
export class LiveArtAction {
  static async handle(req: Request, res: Response) {
    try {
      if (!(await liveListenerAllowed(req.query.t))) { res.status(403).json({ error: "Forbidden" }); return; }
      const artUrl = (await StationController.liveStreamTarget())?.nowPlaying.artUrl;
      if (!artUrl) { res.status(404).json({ error: "No artwork" }); return; }
      const { res: upstream, clearTimeout } = await fetchFromAzuraCast(artUrl);
      try {
        const type = upstream.headers.get("content-type") ?? "";
        if (!upstream.ok || !/^image\/(png|jpeg|webp|gif)$/i.test(type.split(";")[0].trim())) {
          res.status(404).json({ error: "No artwork" });
          return;
        }
        const buf = Buffer.from(await upstream.arrayBuffer());
        if (buf.length > MAX_ART_BYTES) { res.status(404).json({ error: "No artwork" }); return; }
        res.setHeader("Content-Type", type);
        res.setHeader("Cache-Control", "private, max-age=60");
        res.send(buf);
      } finally {
        clearTimeout();
      }
    } catch (err) {
      sendError(res, err, "GET /station/live/art");
    }
  }
}
