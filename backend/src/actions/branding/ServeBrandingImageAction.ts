import { Request, Response } from "express";
import { pipeline } from "node:stream/promises";
import BrandingController from "../../controllers/BrandingController.js";
import { sendError } from "../../lib/http-error.js";
import { isUuid } from "../../lib/branding.js";

/**
 * Public: logos and backgrounds appear on the sign-in page. Only branding
 * images are reachable here, by random id, never media files.
 */
export class ServeBrandingImageAction {
  static async handle(req: Request, res: Response) {
    try {
      const id = req.params.id;
      if (!isUuid(id)) { res.status(404).json({ error: "Not found" }); return; }
      const found = await BrandingController.openAsset(id);
      if (!found) { res.status(404).json({ error: "Not found" }); return; }
      res.setHeader("Content-Type", found.asset.mimeType);
      res.setHeader("Content-Length", found.asset.sizeBytes);
      res.setHeader("X-Content-Type-Options", "nosniff");
      // An id always points at the same image, so browsers can keep it.
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      await pipeline(found.stream, res).catch(() => { if (!res.writableEnded) res.destroy(); });
    } catch (err) {
      sendError(res, err, "GET /branding/images/:id");
    }
  }
}
