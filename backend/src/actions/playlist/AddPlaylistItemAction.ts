import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";

export class AddPlaylistItemAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { mediaId } = req.body ?? {};
      if (!Number.isSafeInteger(mediaId) || mediaId <= 0) { res.status(400).json({ error: "mediaId is required" }); return; }
      res.status(201).json(await StationController.addItem(mediaId));
    } catch (err) {
      sendError(res, err, "POST /admin/playlist");
    }
  }
}
