import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import { PasswordResetRequest, User, sequelize } from "../models/index.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { decryptSecret } from "../lib/secret-cipher.js";
import { verifyToken } from "../lib/totp.js";
import { forget } from "../lib/presence.js";

/** A request not approved within this long has to be made again. */
export const RESET_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 8;
const RECENT_DAYS = 30;

// A real bcrypt hash, compared against when the email is unknown, so a reply
// takes as long whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

type Approver = { id: number; role: string };

const pendingWhere = () => ({ status: "pending", createdAt: { [Op.gte]: new Date(Date.now() - RESET_REQUEST_TTL_MS) } });

/** Who an approver may decide for: listeners, plus admins for the super admin. */
function rolesFor(approver: Approver) {
  return approver.role === "super_admin" ? ["user", "admin", "super_admin"] : ["user"];
}

function view(r: PasswordResetRequest) {
  return {
    id: r.id,
    createdAt: r.createdAt,
    expiresAt: new Date(r.createdAt.getTime() + RESET_REQUEST_TTL_MS),
    verifiedWith2fa: r.verifiedWith2fa,
    user: { id: r.user!.id, name: r.user!.name, email: r.user!.email, role: r.user!.role },
  };
}

export default class PasswordResetController {
  /**
   * Records a request to change a password. The reply never says whether the
   * email exists or the code was right, so this can't be used to find accounts.
   * An account with 2FA must give a current authenticator code; without one
   * (sign-up not finished), the request is marked unverified for the admin.
   */
  static async request(input: { email: unknown; newPassword: unknown; code: unknown }) {
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input.newPassword === "string" ? input.newPassword : "";
    const code = typeof input.code === "string" ? input.code.replace(/\s/g, "") : "";
    if (!email) throw new HttpError(400, "Enter your email");
    if (password.length < MIN_PASSWORD_LENGTH) throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    if (password.length > 200) throw new HttpError(400, "Password is too long");

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.findOne({ where: { email } });
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      return;
    }
    let verified = false;
    if (user.totpEnabled && user.totpSecret) {
      if (!/^\d{6}$/.test(code) || !verifyToken(decryptSecret(user.totpSecret), code)) {
        logger.info({ userId: user.id }, "Password reset request with a wrong authenticator code; not recorded");
        return;
      }
      verified = true;
    }
    if (await bcrypt.compare(password, user.passwordHash)) return; // Same as now: nothing to do.

    await sequelize.transaction(async (transaction) => {
      // A newer request replaces an older one.
      await PasswordResetRequest.update(
        { status: "replaced", decidedAt: new Date() },
        { where: { userId: user.id, status: "pending" }, transaction },
      );
      await PasswordResetRequest.create({ userId: user.id, passwordHash, verifiedWith2fa: verified }, { transaction });
    });
  }

  /**
   * True when `password` is the new password in this account's pending request,
   * so sign-in can say it's awaiting approval. Only someone who knows that
   * password learns anything.
   */
  static async isAwaitingApproval(userId: number, password: string) {
    const r = await PasswordResetRequest.findOne({ where: { userId, ...pendingWhere() } });
    return !!r && (await bcrypt.compare(password, r.passwordHash));
  }

  static async listPending(approver: Approver) {
    const rows = await PasswordResetRequest.findAll({
      where: pendingWhere(),
      include: [{ model: User, as: "user", where: { role: rolesFor(approver) }, attributes: ["id", "name", "email", "role"] }],
      order: [["createdAt", "ASC"]],
    });
    return rows.map(view);
  }

  /** Approved and declined requests from the last 30 days, newest first, with who decided. */
  static async listRecent(approver: Approver) {
    const rows = await PasswordResetRequest.findAll({
      where: { status: ["approved", "declined"], decidedAt: { [Op.gte]: new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000) } },
      include: [
        { model: User, as: "user", where: { role: rolesFor(approver) }, attributes: ["id", "name", "email", "role"] },
        { model: User, as: "decidedBy", attributes: ["id", "name"], required: false },
      ],
      order: [["decidedAt", "DESC"]],
      limit: 50,
    });
    return rows.map(r => ({
      ...view(r),
      status: r.status as "approved" | "declined",
      decidedAt: r.decidedAt,
      decidedBy: (r as any).decidedBy ? { id: (r as any).decidedBy.id, name: (r as any).decidedBy.name } : null,
    }));
  }

  static async countPending(approver: Approver) {
    return PasswordResetRequest.count({
      where: pendingWhere(),
      include: [{ model: User, as: "user", where: { role: rolesFor(approver) }, attributes: [] }],
    });
  }

  /**
   * Approves or declines. Approving sets the new password and signs the account
   * out everywhere. Only the super admin decides for admin accounts, and nobody
   * approves their own request.
   */
  static async decide(id: number, approve: boolean, approver: Approver) {
    const r = await PasswordResetRequest.findOne({
      where: { id, ...pendingWhere() },
      include: [{ model: User, as: "user", where: { role: rolesFor(approver) } }],
    });
    if (!r) return null; // Unknown, already decided, expired, or not this approver's to decide.
    if (r.userId === approver.id) throw new HttpError(403, "Someone else has to approve your own password reset");
    const user = r.user!;
    await sequelize.transaction(async (transaction) => {
      if (approve) {
        user.passwordHash = r.passwordHash;
        user.tokenVersion += 1;
        await user.save({ transaction });
      }
      r.status = approve ? "approved" : "declined";
      r.decidedAt = new Date();
      r.decidedById = approver.id;
      await r.save({ transaction });
    });
    if (approve) forget(user.id);
    return { id: r.id, status: r.status };
  }
}
