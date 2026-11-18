import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import PlaylistController from "../../controllers/PlaylistController.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";
import { parseId } from "../../lib/params.js";

export class ListPlaylistsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      res.json(await PlaylistController.list());
    } catch (err) {
      sendError(res, err, "GET /admin/playlists");
    }
  }
}
