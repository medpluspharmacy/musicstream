import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import listenersRouter from "./listeners";
import mediaRouter from "./media";
import stationRouter from "./station";
import integrationsRouter from "./integrations";
import teamRouter from "./team";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(listenersRouter);
router.use(mediaRouter);
router.use(stationRouter);
router.use(integrationsRouter);
router.use(teamRouter);
router.use(settingsRouter);

export default router;
