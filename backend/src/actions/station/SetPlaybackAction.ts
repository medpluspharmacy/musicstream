import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StationController, { MAX_CROSSFADE_SECONDS } from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";

export class SetPlaybackAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { crossfadeSeconds, gapless } = req.body ?? {};
      if (!Number.isInteger(crossfadeSeconds) || crossfadeSeconds < 0 || crossfadeSeconds > MAX_CROSSFADE_SECONDS) {
        res.status(400).json({ error: `crossfadeSeconds must be a whole number from 0 to ${MAX_CROSSFADE_SECONDS}` });
        return;
      }
      if (typeof gapless !== "boolean") { res.status(400).json({ error: "gapless must be true or false" }); return; }
      res.json(await StationController.setPlayback({ crossfadeSeconds, gapless }));
    } catch (err) {
      sendError(res, err, "PUT /admin/station/playback");
    }
  }
}
