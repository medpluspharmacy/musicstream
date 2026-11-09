import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StorageController from "../../controllers/StorageController.js";
import { sendError } from "../../lib/http-error.js";

export class ResetStorageSettingsAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await StorageController.useEnvironment());
    } catch (err) {
      sendError(res, err, "DELETE /admin/settings/storage");
    }
  }
}
