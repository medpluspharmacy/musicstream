import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import PasswordResetController from "../../controllers/PasswordResetController.js";
import { sendError } from "../../lib/http-error.js";
import { parseId } from "../../lib/params.js";

export class ApprovePasswordResetAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseId(req.params.id);
      const result = id && await PasswordResetController.decide(id, true, req.user!);
      if (!result) { res.status(404).json({ error: "This request is no longer waiting" }); return; }
      res.json(result);
    } catch (err) {
      sendError(res, err, "POST /admin/password-resets/:id/approve");
    }
  }
}
