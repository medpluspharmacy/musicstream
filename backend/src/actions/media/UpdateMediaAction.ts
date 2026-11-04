import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import MediaController from "../../controllers/MediaController.js";
import { sendError } from "../../lib/http-error.js";
import { parseId } from "../../lib/params.js";

export class UpdateMediaAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseId(req.params.id);
      const { title } = req.body ?? {};
      if (typeof title !== "string" || !title.trim()) { res.status(400).json({ error: "Title is required" }); return; }
      const updated = id && await MediaController.rename(id, title);
      if (!updated) { res.status(404).json({ error: "Media not found" }); return; }
      res.json(updated);
    } catch (err) {
      sendError(res, err, "PATCH /admin/media/:id");
    }
  }
}
