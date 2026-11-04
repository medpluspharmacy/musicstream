import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import ListenerController from "../../controllers/ListenerController.js";
import { sendError } from "../../lib/http-error.js";
import { parseId } from "../../lib/params.js";

export class ResetListener2FAAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseId(req.params.id);
      const updated = id && await ListenerController.reset2FA(id);
      if (!updated) { res.status(404).json({ error: "Listener not found" }); return; }
      res.json(updated);
    } catch (err) {
      sendError(res, err, "POST /admin/listeners/:id/reset-2fa");
    }
  }
}
