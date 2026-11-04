import { Router } from "express";
import { HealthCheckAction } from "../actions/health/HealthCheckAction.js";

const router = Router();

router.get("/healthz", HealthCheckAction.handle);

export default router;
