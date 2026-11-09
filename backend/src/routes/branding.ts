import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { GetBrandingAction } from "../actions/branding/GetBrandingAction.js";
import { ServeBrandingImageAction } from "../actions/branding/ServeBrandingImageAction.js";
import { GetBrandingSettingsAction } from "../actions/branding/GetBrandingSettingsAction.js";
import { SaveBrandingAction } from "../actions/branding/SaveBrandingAction.js";
import { UploadBrandingImageAction } from "../actions/branding/UploadBrandingImageAction.js";

const router = Router();

// Public: the sign-in page needs these before anyone signs in.
router.get("/branding", GetBrandingAction.handle);
router.get("/branding/assets/:id", ServeBrandingImageAction.handle);

// The company's branding is set by the super admin.
router.get("/admin/branding", requireAuth, requireRole("super_admin"), GetBrandingSettingsAction.handle);
router.put("/admin/branding", requireAuth, requireRole("super_admin"), SaveBrandingAction.handle);
router.post("/admin/branding/images", requireAuth, requireRole("super_admin"), UploadBrandingImageAction.handle);

export default router;
