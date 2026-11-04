import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { GetDashboardSummaryAction } from "../actions/dashboard/GetDashboardSummaryAction.js";

const router = Router();

router.get("/dashboard/summary", requireAuth, requireRole("admin"), GetDashboardSummaryAction.handle);

export default router;
