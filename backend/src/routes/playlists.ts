import { Router } from "express";
import { requireAuth, requirePermission } from "../middlewares/auth.js";
import { ListPlaylistsAction } from "../actions/playlists/ListPlaylistsAction.js";
import { CreatePlaylistAction } from "../actions/playlists/CreatePlaylistAction.js";
import { RenamePlaylistAction } from "../actions/playlists/RenamePlaylistAction.js";
import { DeletePlaylistAction } from "../actions/playlists/DeletePlaylistAction.js";
import { ListPlaylistItemsAction } from "../actions/playlists/ListPlaylistItemsAction.js";
import { AddPlaylistItemToAction } from "../actions/playlists/AddPlaylistItemToAction.js";
import { ReorderPlaylistItemsAction } from "../actions/playlists/ReorderPlaylistItemsAction.js";
import { RemovePlaylistItemFromAction } from "../actions/playlists/RemovePlaylistItemFromAction.js";
import { GetScheduleAction } from "../actions/playlists/GetScheduleAction.js";
import { SaveScheduleAction } from "../actions/playlists/SaveScheduleAction.js";

const router = Router();
const station = [requireAuth, requirePermission("station")];

router.get("/admin/playlists", ...station, ListPlaylistsAction.handle);
router.post("/admin/playlists", ...station, CreatePlaylistAction.handle);
router.patch("/admin/playlists/:id", ...station, RenamePlaylistAction.handle);
router.delete("/admin/playlists/:id", ...station, DeletePlaylistAction.handle);
router.get("/admin/playlists/:id/items", ...station, ListPlaylistItemsAction.handle);
router.post("/admin/playlists/:id/items", ...station, AddPlaylistItemToAction.handle);
router.put("/admin/playlists/:id/items/order", ...station, ReorderPlaylistItemsAction.handle);
router.delete("/admin/playlists/:id/items/:itemId", ...station, RemovePlaylistItemFromAction.handle);
router.get("/admin/schedule", ...station, GetScheduleAction.handle);
router.put("/admin/schedule", ...station, SaveScheduleAction.handle);

export default router;
