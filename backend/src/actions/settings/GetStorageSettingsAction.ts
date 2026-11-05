import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StorageController from "../../controllers/StorageController.js";
import { sendError } from "../../lib/http-error.js";

export class GetStorageSettingsAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await StorageController.get());
    } catch (err) {
      sendError(res, err, "GET /admin/settings/storage");
    }
  }
}
