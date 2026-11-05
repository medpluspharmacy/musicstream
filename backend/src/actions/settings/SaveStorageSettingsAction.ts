import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StorageController from "../../controllers/StorageController.js";
import { sendError } from "../../lib/http-error.js";

export class SaveStorageSettingsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      res.json(await StorageController.save(req.body ?? {}));
    } catch (err) {
      sendError(res, err, "PUT /admin/settings/storage");
    }
  }
}
