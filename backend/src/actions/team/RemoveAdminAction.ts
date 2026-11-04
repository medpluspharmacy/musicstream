import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AdminTeamController from "../../controllers/AdminTeamController.js";
import { sendError } from "../../lib/http-error.js";
import { parseId } from "../../lib/params.js";

export class RemoveAdminAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseId(req.params.id);
      const updated = id && await AdminTeamController.demote(id);
      if (!updated) { res.status(404).json({ error: "Admin not found" }); return; }
      res.json(updated);
    } catch (err) {
      sendError(res, err, "DELETE /admin/team/:id");
    }
  }
}
