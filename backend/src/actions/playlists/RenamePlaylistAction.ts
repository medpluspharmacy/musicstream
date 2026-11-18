import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import PlaylistController from "../../controllers/PlaylistController.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";
import { parseId } from "../../lib/params.js";

export class RenamePlaylistAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseId(req.params.id);
      if (!id) { res.status(404).json({ error: "Playlist not found" }); return; }
      res.json(await PlaylistController.rename(id, req.body ?? {}));
    } catch (err) {
      sendError(res, err, "PATCH /admin/playlists/:id");
    }
  }
}
