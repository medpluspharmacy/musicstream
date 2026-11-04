import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";

export class SetStationSourceAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { source } = req.body ?? {};
      if (source !== "playlist" && source !== "azuracast") { res.status(400).json({ error: "source must be playlist or azuracast" }); return; }
      res.json(await StationController.setSource(source));
    } catch (err) {
      sendError(res, err, "PUT /admin/station/source");
    }
  }
}
