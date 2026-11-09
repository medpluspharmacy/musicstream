import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";
import { markSeen } from "../../lib/presence.js";

export class NowPlayingAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await StationController.nowPlaying(req.user!);
      // The player polls this, so it doubles as the "who's connected" signal.
      markSeen(req.user!.id, req.query.listening === "1");
      res.json(result);
    } catch (err) {
      sendError(res, err, "GET /station/now-playing");
    }
  }
}
