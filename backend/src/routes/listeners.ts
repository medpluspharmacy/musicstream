import { Router } from "express";
import { requireAuth, requirePermission } from "../middlewares/auth.js";
import { ListListenersAction } from "../actions/listeners/ListListenersAction.js";
import { UpdateListenerAction } from "../actions/listeners/UpdateListenerAction.js";
import { ResetListener2FAAction } from "../actions/listeners/ResetListener2FAAction.js";
import { ApproveListenerAction } from "../actions/listeners/ApproveListenerAction.js";
import { DeclineListenerAction } from "../actions/listeners/DeclineListenerAction.js";

const router = Router();

router.get("/admin/listeners", requireAuth, requirePermission("listeners"), ListListenersAction.handle);
router.patch("/admin/listeners/:id", requireAuth, requirePermission("listeners"), UpdateListenerAction.handle);
router.post("/admin/listeners/:id/approve", requireAuth, requirePermission("listeners"), ApproveListenerAction.handle);
router.post("/admin/listeners/:id/decline", requireAuth, requirePermission("listeners"), DeclineListenerAction.handle);
router.post("/admin/listeners/:id/reset-2fa", requireAuth, requirePermission("listeners"), ResetListener2FAAction.handle);

export default router;
