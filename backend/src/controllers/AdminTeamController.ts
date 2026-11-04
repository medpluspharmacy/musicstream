import { Op } from "sequelize";
import { User } from "../models/index.js";
import { toPublicUser } from "./AuthController.js";
import { HttpError } from "../lib/http-error.js";
import { isPermission, type Permission } from "../lib/permissions.js";

/**
 * The super admin's management of sub-admins (role "admin"). Sub-admins are
 * promoted from approved listener accounts, so they've already signed up and
 * set up 2FA. The super admin account itself is never reachable here.
 */
export default class AdminTeamController {
  static parsePermissions(input: unknown): Permission[] {
    if (!Array.isArray(input) || !input.every(isPermission)) {
      throw new HttpError(400, "permissions must be a list of: station, listeners, integrations");
    }
    const unique = [...new Set(input)];
    if (unique.length === 0) throw new HttpError(400, "Give the admin at least one area to manage");
    return unique;
  }

  static async listAll() {
    const admins = await User.findAll({
      where: { role: { [Op.in]: ["super_admin", "admin"] } },
      order: [["role", "DESC"], ["name", "ASC"]],
    });
    return admins.map(toPublicUser);
  }

  static async promote(userId: number, permissions: Permission[]) {
    const user = await User.findOne({ where: { id: userId, role: "user" } });
    if (!user) return null;
    if (!user.isActive || user.approvalStatus !== "approved") throw new HttpError(400, "Only approved, active listeners can become admins");
    if (!user.totpEnabled) throw new HttpError(400, "They need to finish setting up 2FA first");
    user.role = "admin";
    user.permissions = permissions;
    await user.save();
    return toPublicUser(user);
  }

  static async setPermissions(id: number, permissions: Permission[]) {
    const user = await User.findOne({ where: { id, role: "admin" } });
    if (!user) return null;
    user.permissions = permissions;
    await user.save();
    return toPublicUser(user);
  }

  /** Removes admin rights; they stay an approved listener. */
  static async demote(id: number) {
    const user = await User.findOne({ where: { id, role: "admin" } });
    if (!user) return null;
    user.role = "user";
    user.permissions = [];
    user.approvalStatus = "approved";
    await user.save();
    return toPublicUser(user);
  }
}
