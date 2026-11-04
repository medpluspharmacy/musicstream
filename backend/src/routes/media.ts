import { Router } from "express";
import { requireAuth, requirePermission } from "../middlewares/auth.js";
import { ListMediaAction } from "../actions/media/ListMediaAction.js";
import { UploadMediaAction } from "../actions/media/UploadMediaAction.js";
import { UpdateMediaAction } from "../actions/media/UpdateMediaAction.js";
import { DeleteMediaAction } from "../actions/media/DeleteMediaAction.js";
import { StreamMediaAction } from "../actions/media/StreamMediaAction.js";

const router = Router();

router.get("/admin/media", requireAuth, requirePermission("station"), ListMediaAction.handle);
router.post("/admin/media", requireAuth, requirePermission("station"), UploadMediaAction.handle);
router.patch("/admin/media/:id", requireAuth, requirePermission("station"), UpdateMediaAction.handle);
router.delete("/admin/media/:id", requireAuth, requirePermission("station"), DeleteMediaAction.handle);
// Authorised by the signed token in the URL (media elements can't send headers).
router.get("/media/:id/stream", StreamMediaAction.handle);

export default router;
