import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import MediaController from "../../controllers/MediaController.js";
import { sendError } from "../../lib/http-error.js";
import { parseId } from "../../lib/params.js";

export class DeleteMediaAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseId(req.params.id);
      const result = id && await MediaController.delete(id);
      if (!result) { res.status(404).json({ error: "Media not found" }); return; }
      res.json({ success: true });
    } catch (err) {
      sendError(res, err, "DELETE /admin/media/:id");
    }
  }
}
