import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { GetStorageSettingsAction } from "../actions/settings/GetStorageSettingsAction.js";
import { SaveStorageSettingsAction } from "../actions/settings/SaveStorageSettingsAction.js";
import { ResetStorageSettingsAction } from "../actions/settings/ResetStorageSettingsAction.js";

const router = Router();

// Storage keys reach every uploaded file, so only the super admin can change them.
router.get("/admin/settings/storage", requireAuth, requireRole("super_admin"), GetStorageSettingsAction.handle);
router.put("/admin/settings/storage", requireAuth, requireRole("super_admin"), SaveStorageSettingsAction.handle);
router.delete("/admin/settings/storage", requireAuth, requireRole("super_admin"), ResetStorageSettingsAction.handle);

export default router;
