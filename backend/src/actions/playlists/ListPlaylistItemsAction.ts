import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import PlaylistController from "../../controllers/PlaylistController.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";
import { parseId } from "../../lib/params.js";

export class ListPlaylistItemsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseId(req.params.id);
      if (!id) { res.status(404).json({ error: "Playlist not found" }); return; }
      await PlaylistController.find(id);
      res.json(await StationController.listPlaylist(id));
    } catch (err) {
      sendError(res, err, "GET /admin/playlists/:id/items");
    }
  }
}
