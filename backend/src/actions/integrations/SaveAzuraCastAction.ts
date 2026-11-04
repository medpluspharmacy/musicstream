import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import IntegrationController from "../../controllers/IntegrationController.js";
import { sendError } from "../../lib/http-error.js";

export class SaveAzuraCastAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      res.json(await IntegrationController.saveAzuraCast(req.body ?? {}));
    } catch (err) {
      sendError(res, err, "PUT /admin/integrations/azuracast");
    }
  }
}
