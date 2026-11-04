import { Request, Response } from "express";
import AuthController from "../../controllers/AuthController.js";
import { sendError } from "../../lib/http-error.js";

export class RegisterAction {
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password } = req.body ?? {};
      if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
        res.status(400).json({ error: "Name, email and password are required" });
        return;
      }
      res.status(201).json(await AuthController.register(name, email, password));
    } catch (err) {
      sendError(res, err, "POST /auth/register");
    }
  }
}
