import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AuthController from "../../controllers/AuthController.js";

export class GetMeAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const user = await AuthController.getMe(req.user!.id);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }
      res.json(user);
    } catch (err) {
      console.error("GET /auth/me error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
