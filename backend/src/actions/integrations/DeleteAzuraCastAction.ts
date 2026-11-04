import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import IntegrationController from "../../controllers/IntegrationController.js";
import { sendError } from "../../lib/http-error.js";

export class DeleteAzuraCastAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await IntegrationController.removeAzuraCast());
    } catch (err) {
      sendError(res, err, "DELETE /admin/integrations/azuracast");
    }
  }
}
