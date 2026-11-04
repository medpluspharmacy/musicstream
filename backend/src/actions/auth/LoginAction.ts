import { Request, Response } from "express";
import AuthController from "../../controllers/AuthController.js";
import { sendError } from "../../lib/http-error.js";

export class LoginAction {
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body ?? {};
      if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }
      res.json(await AuthController.login(email, password));
    } catch (err) {
      sendError(res, err, "POST /auth/login");
    }
  }
}
