import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AuthController from "../../controllers/AuthController.js";

export class LogoutAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      await AuthController.logout(req.user!.id);
      res.json({ success: true });
    } catch (err) {
      console.error("POST /auth/logout error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
