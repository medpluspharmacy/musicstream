import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";

export class StopStationAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await StationController.stop());
    } catch (err) {
      sendError(res, err, "POST /admin/station/stop");
    }
  }
}
