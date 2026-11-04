import { Request, Response } from "express";
import HealthController from "../../controllers/HealthController.js";

export class HealthCheckAction {
  static handle(_req: Request, res: Response) {
    res.json(HealthController.check());
  }
}
