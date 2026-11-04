import bcrypt from "bcryptjs";
import { User } from "../models/index.js";
import {
  ADMIN_ROLES,
  generateToken,
  generatePendingToken,
  verifyPendingToken,
  type PendingPurpose,
} from "../middlewares/auth.js";
import { generateSecret, generateQrDataUrl, verifyToken } from "../lib/totp.js";
import { encryptSecret, decryptSecret } from "../lib/secret-cipher.js";
import { HttpError } from "../lib/http-error.js";
import { effectivePermissions } from "../lib/permissions.js";

export function toPublicUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    totpEnabled: u.totpEnabled,
    approvalStatus: u.approvalStatus,
    permissions: effectivePermissions(u),
    createdAt: u.createdAt,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default class AuthController {
  /**
   * Throws if the account may not sign in right now. Pending listeners can
   * sign in (they see a waiting screen); declined ones can't.
   */
  static async assertCanSignIn(user: User) {
    if (!user.isActive) throw new HttpError(403, "Account is deactivated");
    if (!ADMIN_ROLES.includes(user.role) && user.approvalStatus === "declined") {
      throw new HttpError(403, "Your request to join wasn't approved. Contact an administrator if you think this is a mistake.");
    }
  }

  /** Every sign-in needs a second factor: verify it, or set it up first. */
  static pendingResponse(user: User) {
    const purpose: PendingPurpose = user.totpEnabled ? "2fa-verify" : "2fa-setup";
    return {
      requires2FA: user.totpEnabled,
      requires2FASetup: !user.totpEnabled,
      pendingToken: generatePendingToken({ id: user.id, purpose, tokenVersion: user.tokenVersion }),
    };
  }

  static async login(email: string, password: string) {
    const user = await User.findOne({ where: { email: email.trim().toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, "Invalid email or password");
    }
    await AuthController.assertCanSignIn(user);
    return AuthController.pendingResponse(user);
  }

  static async register(name: string, email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!name.trim()) throw new HttpError(400, "Name is required");
    if (!EMAIL_RE.test(normalizedEmail)) throw new HttpError(400, "Enter a valid email address");
    if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
    if (await User.findOne({ where: { email: normalizedEmail } })) {
      throw new HttpError(409, "An account with that email already exists");
    }
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: "user",
      approvalStatus: "pending",
    });
    return AuthController.pendingResponse(user);
  }

  private static async loadPending(token: unknown, purpose: PendingPurpose) {
    const claims = verifyPendingToken(token, purpose);
    if (!claims) throw new HttpError(401, "Your sign-in session expired. Please sign in again.");
    const user = await User.findByPk(claims.id);
    if (!user || user.tokenVersion !== claims.tokenVersion) {
      throw new HttpError(401, "Your sign-in session expired. Please sign in again.");
    }
    await AuthController.assertCanSignIn(user);
    return user;
  }

  private static async issueSession(user: User) {
    // Bump token_version so any older session is invalidated.
    await user.increment("tokenVersion");
    await user.reload();
    const token = generateToken({ id: user.id, role: user.role, email: user.email, tokenVersion: user.tokenVersion });
    return { token, user: toPublicUser(user) };
  }

  static async setup2FA(pendingToken: unknown) {
    const user = await AuthController.loadPending(pendingToken, "2fa-setup");
    if (user.totpEnabled) throw new HttpError(409, "Two-factor authentication is already set up");
    const secret = generateSecret(user.email);
    user.totpSecret = encryptSecret(secret.base32);
    await user.save();
    return { qrDataUrl: await generateQrDataUrl(secret.otpauthUrl), secret: secret.base32 };
  }

  static async enable2FA(pendingToken: unknown, code: string) {
    const user = await AuthController.loadPending(pendingToken, "2fa-setup");
    if (user.totpEnabled) throw new HttpError(409, "Two-factor authentication is already set up");
    if (!user.totpSecret) throw new HttpError(400, "Start two-factor setup first");
    if (!verifyToken(decryptSecret(user.totpSecret), code)) throw new HttpError(401, "Invalid code");
    user.totpEnabled = true;
    await user.save();
    return AuthController.issueSession(user);
  }

  static async verify2FA(pendingToken: unknown, code: string) {
    const user = await AuthController.loadPending(pendingToken, "2fa-verify");
    if (!user.totpEnabled || !user.totpSecret) throw new HttpError(400, "Two-factor authentication is not set up");
    if (!verifyToken(decryptSecret(user.totpSecret), code)) throw new HttpError(401, "Invalid code");
    return AuthController.issueSession(user);
  }

  static async getMe(id: number) {
    const user = await User.findByPk(id);
    return user ? toPublicUser(user) : null;
  }

  static async logout(id: number) {
    await User.increment("tokenVersion", { where: { id } });
  }
}
