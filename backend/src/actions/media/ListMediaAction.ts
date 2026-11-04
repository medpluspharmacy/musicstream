import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import MediaController from "../../controllers/MediaController.js";
import { sendError } from "../../lib/http-error.js";

export class ListMediaAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await MediaController.listAll());
    } catch (err) {
      sendError(res, err, "GET /admin/media");
    }
  }
}
