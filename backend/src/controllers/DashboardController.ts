import { Op } from "sequelize";
import { User, MediaFile } from "../models/index.js";
import StationController from "./StationController.js";
import ListenerController from "./ListenerController.js";

export default class DashboardController {
  static async summary() {
    const [listeners, activeListeners, pending2FA, pendingApproval, mediaCount, station, connected] = await Promise.all([
      User.count({ where: { role: "user" } }),
      User.count({ where: { role: "user", isActive: true, totpEnabled: true, approvalStatus: "approved" } }),
      User.count({ where: { role: "user", isActive: true, totpEnabled: false } }),
      User.count({ where: { role: "user", isActive: true, approvalStatus: "pending" } }),
      MediaFile.count(),
      StationController.status(),
      ListenerController.connected(),
    ]);
    const newListenersThisWeek = await User.count({
      where: { role: "user", createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });
    return {
      listeners,
      activeListeners,
      pending2FA,
      newListenersThisWeek,
      pendingApproval,
      mediaCount,
      station,
      listeningNow: connected.filter(c => c.listening).length,
    };
  }
}
