import { Request, Response } from "express";
import AuthController from "../../controllers/AuthController.js";
import { sendError } from "../../lib/http-error.js";

export class Setup2FAAction {
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      res.json(await AuthController.setup2FA(req.body?.pendingToken));
    } catch (err) {
      sendError(res, err, "POST /auth/2fa/setup");
    }
  }
}
