import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import PlaylistController from "../../controllers/PlaylistController.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";
import { parseId } from "../../lib/params.js";

export class DeletePlaylistAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseId(req.params.id);
      if (!id) { res.status(404).json({ error: "Playlist not found" }); return; }
      res.json(await PlaylistController.remove(id));
    } catch (err) {
      sendError(res, err, "DELETE /admin/playlists/:id");
    }
  }
}
