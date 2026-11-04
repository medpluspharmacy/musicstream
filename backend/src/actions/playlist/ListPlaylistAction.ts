import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";

export class ListPlaylistAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await StationController.listPlaylist());
    } catch (err) {
      sendError(res, err, "GET /admin/playlist");
    }
  }
}
