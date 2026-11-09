import { Request, Response } from "express";
import BrandingController from "../../controllers/BrandingController.js";
import { sendError } from "../../lib/http-error.js";

/** Public: the sign-in page shows the company name, logo and backgrounds. */
export class GetBrandingAction {
  static async handle(_req: Request, res: Response) {
    try {
      res.setHeader("Cache-Control", "no-cache");
      res.json(await BrandingController.publicSettings());
    } catch (err) {
      sendError(res, err, "GET /branding");
    }
  }
}
