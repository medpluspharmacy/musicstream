import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AdminTeamController from "../../controllers/AdminTeamController.js";
import { sendError } from "../../lib/http-error.js";

export class ListAdminsAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await AdminTeamController.listAll());
    } catch (err) {
      sendError(res, err, "GET /admin/team");
    }
  }
}
