import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";
import { parseId } from "../../lib/params.js";

export class RemovePlaylistItemAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseId(req.params.id);
      const result = id && await StationController.removeItem(id);
      if (!result) { res.status(404).json({ error: "Playlist item not found" }); return; }
      res.json({ success: true });
    } catch (err) {
      sendError(res, err, "DELETE /admin/playlist/:id");
    }
  }
}
