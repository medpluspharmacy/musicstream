import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import ListenerController from "../../controllers/ListenerController.js";
import { sendError } from "../../lib/http-error.js";

export class ListListenersAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await ListenerController.listAll());
    } catch (err) {
      sendError(res, err, "GET /admin/listeners");
    }
  }
}
