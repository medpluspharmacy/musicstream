import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import PlaylistController from "../../controllers/PlaylistController.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";
import { parseId } from "../../lib/params.js";

export class ReorderPlaylistItemsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseId(req.params.id);
      if (!id) { res.status(404).json({ error: "Playlist not found" }); return; }
      const { itemIds } = req.body ?? {};
      if (!Array.isArray(itemIds) || !itemIds.every(i => Number.isSafeInteger(i))) { res.status(400).json({ error: "itemIds must be a list of playlist item ids" }); return; }
      await PlaylistController.find(id);
      res.json(await StationController.reorder(itemIds, id));
    } catch (err) {
      sendError(res, err, "PUT /admin/playlists/:id/items/order");
    }
  }
}
