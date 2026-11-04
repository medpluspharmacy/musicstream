import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ListAdminsAction } from "../actions/team/ListAdminsAction.js";
import { PromoteAdminAction } from "../actions/team/PromoteAdminAction.js";
import { UpdateAdminAction } from "../actions/team/UpdateAdminAction.js";
import { RemoveAdminAction } from "../actions/team/RemoveAdminAction.js";

const router = Router();

// Only the super admin manages the admin team.
router.get("/admin/team", requireAuth, requireRole("super_admin"), ListAdminsAction.handle);
router.post("/admin/team", requireAuth, requireRole("super_admin"), PromoteAdminAction.handle);
router.patch("/admin/team/:id", requireAuth, requireRole("super_admin"), UpdateAdminAction.handle);
router.delete("/admin/team/:id", requireAuth, requireRole("super_admin"), RemoveAdminAction.handle);

export default router;
