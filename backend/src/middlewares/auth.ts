import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { type ApprovalStatus } from "../models/User.js";
import { effectivePermissions, type Permission } from "../lib/permissions.js";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set. Server cannot start without it.");
}
if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production (e.g. `openssl rand -base64 48`).");
}
const JWT_SECRET: string = process.env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: { id: number; role: string; email: string; permissions: Permission[]; approvalStatus: ApprovalStatus };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    // Reject 2FA-pending, media and live-stream tokens (they carry a `purpose`
    // claim) so they cannot be used as session tokens.
    if (payload?.purpose || typeof payload?.role !== "string") {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    // Every successful login bumps users.token_version, so tokens issued
    // before that login are rejected here. Role, permissions and approval are
    // read from the database, so changes apply to sessions already signed in.
    let u: User | null;
    try {
      u = await User.findByPk(payload.id, { attributes: ["id", "email", "role", "permissions", "approvalStatus", "tokenVersion", "isActive"] });
      if (!u) {
        res.status(401).json({ error: "Invalid token" });
        return;
      }
      const tokenV = typeof payload.v === "number" ? payload.v : 0;
      if (tokenV !== u.tokenVersion) {
        res.status(401).json({ error: "Session ended", reason: "session_replaced" });
        return;
      }
      if (u.isActive === false) {
        res.status(401).json({ error: "Account is deactivated", reason: "session_replaced" });
        return;
      }
    } catch {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    req.user = { id: u.id, role: u.role, email: u.email, permissions: effectivePermissions(u), approvalStatus: u.approvalStatus };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  user: 1,
};

export function requireRole(...roles: Array<string | string[]>) {
  const flat = roles.flat();
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) { res.status(403).json({ error: "Forbidden" }); return; }
    const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
    const minRequired = Math.min(...flat.map(r => ROLE_HIERARCHY[r] ?? 99));
    if (userLevel >= minRequired) { next(); return; }
    res.status(403).json({ error: "Forbidden" });
  };
}

/** Admin areas: the super admin passes every check, sub-admins need the named permission. */
export function requirePermission(permission: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.permissions.includes(permission)) { next(); return; }
    res.status(403).json({ error: "You don't have access to this area" });
  };
}

/** Listeners must be approved by an admin before they can listen. Admins always pass. */
export function requireApproved(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) { res.status(403).json({ error: "Forbidden" }); return; }
  if (ADMIN_ROLES.includes(req.user.role) || req.user.approvalStatus === "approved") { next(); return; }
  res.status(403).json({ error: "Your account is waiting for approval", reason: "pending_approval" });
}

export function generateToken(user: { id: number; role: string; email: string; tokenVersion: number }) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email, v: user.tokenVersion }, JWT_SECRET, { expiresIn: "12h" });
}

export const ADMIN_ROLES = ["admin", "super_admin"];

export type PendingPurpose = "2fa-verify" | "2fa-setup";

/** Short-lived token proving the password step passed; exchanged for a session after 2FA. */
export function generatePendingToken(payload: { id: number; purpose: PendingPurpose; tokenVersion: number }) {
  return jwt.sign({ id: payload.id, purpose: payload.purpose, v: payload.tokenVersion }, JWT_SECRET, { expiresIn: "10m" });
}

export function verifyPendingToken(token: unknown, purpose: PendingPurpose): { id: number; tokenVersion: number } | null {
  if (typeof token !== "string" || !token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload?.purpose !== purpose || typeof payload.id !== "number" || typeof payload.v !== "number") return null;
    return { id: payload.id, tokenVersion: payload.v };
  } catch {
    return null;
  }
}

/**
 * Media elements can't send an Authorization header, so stream URLs carry a
 * signed token scoped to one media id instead.
 */
export function generateMediaToken(mediaId: number) {
  return jwt.sign({ mid: mediaId, purpose: "media" }, JWT_SECRET, { expiresIn: "6h" });
}

export function verifyMediaToken(token: unknown, mediaId: number): boolean {
  if (typeof token !== "string" || !token) return false;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return payload?.purpose === "media" && payload.mid === mediaId;
  } catch {
    return false;
  }
}

/**
 * Token for the proxied AzuraCast stream. Unlike media tokens it is tied to a
 * user and their session version, so the stream checks the listener is still
 * allowed in when it connects and while it plays.
 */
export function generateLiveToken(user: { id: number; tokenVersion: number }) {
  return jwt.sign({ id: user.id, v: user.tokenVersion, purpose: "live" }, JWT_SECRET, { expiresIn: "6h" });
}

export function verifyLiveToken(token: unknown): { id: number; tokenVersion: number } | null {
  if (typeof token !== "string" || !token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload?.purpose !== "live" || typeof payload.id !== "number" || typeof payload.v !== "number") return null;
    return { id: payload.id, tokenVersion: payload.v };
  } catch {
    return null;
  }
}
