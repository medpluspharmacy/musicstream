import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import ListenerController from "../../controllers/ListenerController.js";
import { sendError } from "../../lib/http-error.js";
import { parseId } from "../../lib/params.js";

export class UpdateListenerAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseId(req.params.id);
      const { isActive } = req.body ?? {};
      if (typeof isActive !== "boolean") { res.status(400).json({ error: "isActive must be true or false" }); return; }
      const updated = id && await ListenerController.setActive(id, isActive);
      if (!updated) { res.status(404).json({ error: "Listener not found" }); return; }
      res.json(updated);
    } catch (err) {
      sendError(res, err, "PATCH /admin/listeners/:id");
    }
  }
}
