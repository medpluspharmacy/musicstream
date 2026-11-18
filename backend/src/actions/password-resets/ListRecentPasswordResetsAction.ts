import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import PasswordResetController from "../../controllers/PasswordResetController.js";
import { sendError } from "../../lib/http-error.js";

export class ListRecentPasswordResetsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      res.json(await PasswordResetController.listRecent(req.user!));
    } catch (err) {
      sendError(res, err, "GET /admin/password-resets/recent");
    }
  }
}
