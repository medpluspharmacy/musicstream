import { Router } from "express";
import { requireAuth, requirePermission } from "../middlewares/auth.js";
import { ListPasswordResetsAction } from "../actions/password-resets/ListPasswordResetsAction.js";
import { ApprovePasswordResetAction } from "../actions/password-resets/ApprovePasswordResetAction.js";
import { DeclinePasswordResetAction } from "../actions/password-resets/DeclinePasswordResetAction.js";
import { ListRecentPasswordResetsAction } from "../actions/password-resets/ListRecentPasswordResetsAction.js";

const router = Router();

// Admins who manage listeners approve listeners' resets; the controller only
// lets the super admin decide for admin accounts.
router.get("/admin/password-resets", requireAuth, requirePermission("listeners"), ListPasswordResetsAction.handle);
router.get("/admin/password-resets/recent", requireAuth, requirePermission("listeners"), ListRecentPasswordResetsAction.handle);
router.post("/admin/password-resets/:id/approve", requireAuth, requirePermission("listeners"), ApprovePasswordResetAction.handle);
router.post("/admin/password-resets/:id/decline", requireAuth, requirePermission("listeners"), DeclinePasswordResetAction.handle);

export default router;
