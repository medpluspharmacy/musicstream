import { Request, Response } from "express";
import PasswordResetController from "../../controllers/PasswordResetController.js";
import { sendError } from "../../lib/http-error.js";

export class ForgotPasswordAction {
  static async handle(req: Request, res: Response) {
    try {
      await PasswordResetController.request(req.body ?? {});
      // The same reply whatever happened, so this can't be used to find accounts.
      res.status(202).json({ message: "If the details are right, your request is with an admin. Your new password works once they approve it." });
    } catch (err) {
      sendError(res, err, "POST /auth/forgot-password");
    }
  }
}
