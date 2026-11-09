import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import BrandingController from "../../controllers/BrandingController.js";
import { sendError } from "../../lib/http-error.js";

export class SaveBrandingAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      res.json(await BrandingController.save(req.body ?? {}));
    } catch (err) {
      sendError(res, err, "PUT /admin/branding");
    }
  }
}
