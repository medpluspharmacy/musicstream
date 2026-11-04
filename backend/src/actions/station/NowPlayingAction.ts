import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";

export class NowPlayingAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      res.json(await StationController.nowPlaying(req.user!));
    } catch (err) {
      sendError(res, err, "GET /station/now-playing");
    }
  }
}
