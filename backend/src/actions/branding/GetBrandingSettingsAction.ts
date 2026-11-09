import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import BrandingController from "../../controllers/BrandingController.js";
import { sendError } from "../../lib/http-error.js";

export class GetBrandingSettingsAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await BrandingController.adminSettings());
    } catch (err) {
      sendError(res, err, "GET /admin/branding");
    }
  }
}
