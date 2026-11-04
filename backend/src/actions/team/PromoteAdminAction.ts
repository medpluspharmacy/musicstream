import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AdminTeamController from "../../controllers/AdminTeamController.js";
import { sendError } from "../../lib/http-error.js";

export class PromoteAdminAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { userId, permissions } = req.body ?? {};
      if (!Number.isSafeInteger(userId) || userId <= 0) { res.status(400).json({ error: "userId is required" }); return; }
      const promoted = await AdminTeamController.promote(userId, AdminTeamController.parsePermissions(permissions));
      if (!promoted) { res.status(404).json({ error: "Listener not found" }); return; }
      res.status(201).json(promoted);
    } catch (err) {
      sendError(res, err, "POST /admin/team");
    }
  }
}
