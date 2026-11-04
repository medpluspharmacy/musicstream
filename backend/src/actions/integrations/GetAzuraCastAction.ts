import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import IntegrationController from "../../controllers/IntegrationController.js";
import { sendError } from "../../lib/http-error.js";

export class GetAzuraCastAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await IntegrationController.getAzuraCast());
    } catch (err) {
      sendError(res, err, "GET /admin/integrations/azuracast");
    }
  }
}
