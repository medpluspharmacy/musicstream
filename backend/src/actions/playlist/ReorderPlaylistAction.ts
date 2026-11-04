import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StationController from "../../controllers/StationController.js";
import { sendError } from "../../lib/http-error.js";

export class ReorderPlaylistAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { itemIds } = req.body ?? {};
      if (!Array.isArray(itemIds) || !itemIds.every(id => Number.isSafeInteger(id))) {
        res.status(400).json({ error: "itemIds must be a list of playlist item ids" });
        return;
      }
      res.json(await StationController.reorder(itemIds));
    } catch (err) {
      sendError(res, err, "PUT /admin/playlist/order");
    }
  }
}
