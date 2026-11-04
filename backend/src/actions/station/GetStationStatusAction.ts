import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";

export class GetStationStatusAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await StationController.status());
    } catch (err) {
      sendError(res, err, "GET /admin/station");
    }
  }
}
