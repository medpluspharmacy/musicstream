import { Router } from "express";
import { requireAuth, requireApproved, requirePermission } from "../middlewares/auth.js";
import { ListPlaylistAction } from "../actions/playlist/ListPlaylistAction.js";
import { AddPlaylistItemAction } from "../actions/playlist/AddPlaylistItemAction.js";
import { RemovePlaylistItemAction } from "../actions/playlist/RemovePlaylistItemAction.js";
import { ReorderPlaylistAction } from "../actions/playlist/ReorderPlaylistAction.js";
import { GetStationStatusAction } from "../actions/station/GetStationStatusAction.js";
import { StartStationAction } from "../actions/station/StartStationAction.js";
import { StopStationAction } from "../actions/station/StopStationAction.js";
import { NowPlayingAction } from "../actions/station/NowPlayingAction.js";
import { SetStationSourceAction } from "../actions/station/SetStationSourceAction.js";
import { StreamLiveAction } from "../actions/station/StreamLiveAction.js";
import { LiveArtAction } from "../actions/station/LiveArtAction.js";

const router = Router();

router.get("/admin/playlist", requireAuth, requirePermission("station"), ListPlaylistAction.handle);
router.post("/admin/playlist", requireAuth, requirePermission("station"), AddPlaylistItemAction.handle);
router.put("/admin/playlist/order", requireAuth, requirePermission("station"), ReorderPlaylistAction.handle);
router.delete("/admin/playlist/:id", requireAuth, requirePermission("station"), RemovePlaylistItemAction.handle);

router.get("/admin/station", requireAuth, requirePermission("station"), GetStationStatusAction.handle);
router.post("/admin/station/start", requireAuth, requirePermission("station"), StartStationAction.handle);
router.post("/admin/station/stop", requireAuth, requirePermission("station"), StopStationAction.handle);
router.put("/admin/station/source", requireAuth, requirePermission("station"), SetStationSourceAction.handle);

router.get("/station/now-playing", requireAuth, requireApproved, NowPlayingAction.handle);
// Audio elements can't send headers; these check the signed live token in `t` instead.
router.get("/station/live", StreamLiveAction.handle);
router.get("/station/live/art", LiveArtAction.handle);

export default router;
