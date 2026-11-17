import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import PasswordResetController from "../../controllers/PasswordResetController.js";
import { sendError } from "../../lib/http-error.js";

export class ListPasswordResetsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      res.json(await PasswordResetController.listPending(req.user!));
    } catch (err) {
      sendError(res, err, "GET /admin/password-resets");
    }
  }
}
