import { Request, Response } from "express";
import AuthController from "../../controllers/AuthController.js";
import { sendError } from "../../lib/http-error.js";

export class Enable2FAAction {
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { pendingToken, code } = req.body ?? {};
      if (typeof code !== "string" || !code.trim()) { res.status(400).json({ error: "Code is required" }); return; }
      res.json(await AuthController.enable2FA(pendingToken, code));
    } catch (err) {
      sendError(res, err, "POST /auth/2fa/enable");
    }
  }
}
