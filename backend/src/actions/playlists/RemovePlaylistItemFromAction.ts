import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import PlaylistController from "../../controllers/PlaylistController.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";
import { parseId } from "../../lib/params.js";

export class RemovePlaylistItemFromAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseId(req.params.id), itemId = parseId(req.params.itemId);
      // The item must belong to this playlist.
      const removed = id && itemId && await StationController.removeItem(itemId, id);
      if (!removed) { res.status(404).json({ error: "Playlist item not found" }); return; }
      res.json({ success: true });
    } catch (err) {
      sendError(res, err, "DELETE /admin/playlists/:id/items/:itemId");
    }
  }
}
