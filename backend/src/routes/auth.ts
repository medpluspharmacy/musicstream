import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { LoginAction } from "../actions/auth/LoginAction.js";
import { RegisterAction } from "../actions/auth/RegisterAction.js";
import { Setup2FAAction } from "../actions/auth/Setup2FAAction.js";
import { Enable2FAAction } from "../actions/auth/Enable2FAAction.js";
import { Verify2FAAction } from "../actions/auth/Verify2FAAction.js";
import { GetMeAction } from "../actions/auth/GetMeAction.js";
import { LogoutAction } from "../actions/auth/LogoutAction.js";

const router = Router();

router.post("/auth/login", LoginAction.handle);
router.post("/auth/register", RegisterAction.handle);
router.post("/auth/2fa/setup", Setup2FAAction.handle);
router.post("/auth/2fa/enable", Enable2FAAction.handle);
router.post("/auth/2fa/verify", Verify2FAAction.handle);
router.get("/auth/me", requireAuth, GetMeAction.handle);
router.post("/auth/logout", requireAuth, LogoutAction.handle);

export default router;
