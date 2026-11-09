import { User } from "../models/index.js";
import { toPublicUser } from "./AuthController.js";
import { connectedNow, forget } from "../lib/presence.js";

// Admin management of listener accounts. Only role "user" rows are reachable
// here, so admins cannot use these endpoints against other admins.
export default class ListenerController {
  static async listAll() {
    const users = await User.findAll({ where: { role: "user" }, order: [["createdAt", "DESC"]] });
    return users.map(toPublicUser);
  }

  static async setActive(id: number, isActive: boolean) {
    const user = await User.findOne({ where: { id, role: "user" } });
    if (!user) return null;
    user.isActive = isActive;
    // Deactivation ends any live session immediately.
    if (!isActive) user.tokenVersion += 1;
    await user.save();
    if (!isActive) forget(user.id);
    return toPublicUser(user);
  }

  /**
   * Approves or declines a sign-up. Declining ends their session; they can't
   * sign in again unless an admin approves them later.
   */
  static async setApproval(id: number, approved: boolean) {
    const user = await User.findOne({ where: { id, role: "user" } });
    if (!user) return null;
    user.approvalStatus = approved ? "approved" : "declined";
    if (!approved) user.tokenVersion += 1;
    await user.save();
    if (!approved) forget(user.id);
    return toPublicUser(user);
  }

  /** Clears 2FA so the listener must set it up again at next sign-in. */
  static async reset2FA(id: number) {
    const user = await User.findOne({ where: { id, role: "user" } });
    if (!user) return null;
    user.totpSecret = null;
    user.totpEnabled = false;
    user.tokenVersion += 1;
    await user.save();
    forget(user.id);
    return toPublicUser(user);
  }

  /** Listeners with the Listen page open now, and whether they're tuned in. Admins aren't listed. */
  static async connected() {
    const present = connectedNow();
    if (present.length === 0) return [];
    const users = await User.findAll({
      where: { id: present.map(p => p.userId), role: "user", isActive: true },
      attributes: ["id", "name", "email"],
    });
    const byId = new Map(users.map(u => [u.id, u]));
    return present.flatMap(p => {
      const u = byId.get(p.userId);
      if (!u) return [];
      return [{
        id: u.id,
        name: u.name,
        email: u.email,
        listening: p.listening,
        connectedSince: new Date(p.connectedSince).toISOString(),
        listeningSince: p.listeningSince ? new Date(p.listeningSince).toISOString() : null,
        lastSeenAt: new Date(p.lastSeen).toISOString(),
      }];
    });
  }

  /** Ends the listener's session on every device. They can sign in again. */
  static async signOut(id: number) {
    const user = await User.findOne({ where: { id, role: "user" } });
    if (!user) return null;
    user.tokenVersion += 1;
    await user.save();
    forget(user.id);
    return toPublicUser(user);
  }
}
