import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import PlaylistController from "../../controllers/PlaylistController.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";
import { parseId } from "../../lib/params.js";

export class AddPlaylistItemToAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseId(req.params.id);
      if (!id) { res.status(404).json({ error: "Playlist not found" }); return; }
      const { mediaId } = req.body ?? {};
      if (!Number.isSafeInteger(mediaId) || mediaId <= 0) { res.status(400).json({ error: "mediaId is required" }); return; }
      await PlaylistController.find(id);
      res.status(201).json(await StationController.addItem(mediaId, id));
    } catch (err) {
      sendError(res, err, "POST /admin/playlists/:id/items");
    }
  }
}
