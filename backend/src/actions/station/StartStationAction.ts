import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";

export class StartStationAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await StationController.start());
    } catch (err) {
      sendError(res, err, "POST /admin/station/start");
    }
  }
}
