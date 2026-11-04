import { User } from "../models/index.js";
import { toPublicUser } from "./AuthController.js";

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
    return toPublicUser(user);
  }
}
