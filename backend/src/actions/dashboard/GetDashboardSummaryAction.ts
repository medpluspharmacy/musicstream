import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import DashboardController from "../../controllers/DashboardController.js";

export class GetDashboardSummaryAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await DashboardController.summary());
    } catch (err) {
      console.error("GET /dashboard/summary error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
