import { Router } from "express";
import { requireAuth, requirePermission } from "../middlewares/auth.js";
import { GetAzuraCastAction } from "../actions/integrations/GetAzuraCastAction.js";
import { SaveAzuraCastAction } from "../actions/integrations/SaveAzuraCastAction.js";
import { DeleteAzuraCastAction } from "../actions/integrations/DeleteAzuraCastAction.js";

const router = Router();

router.get("/admin/integrations/azuracast", requireAuth, requirePermission("integrations"), GetAzuraCastAction.handle);
router.put("/admin/integrations/azuracast", requireAuth, requirePermission("integrations"), SaveAzuraCastAction.handle);
router.delete("/admin/integrations/azuracast", requireAuth, requirePermission("integrations"), DeleteAzuraCastAction.handle);

export default router;
