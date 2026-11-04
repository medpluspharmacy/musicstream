import type { Permission, User } from "./api";

export const ADMIN_ROLES = ["admin", "super_admin"];

export const PERMISSION_LABELS: Record<Permission, { name: string; description: string }> = {
  station: { name: "Station", description: "Media library, playlist, going live and the station source" },
  listeners: { name: "Listeners", description: "Approve or decline sign-ups, deactivate accounts, reset 2FA" },
  integrations: { name: "Integrations", description: "Connect and manage AzuraCast" },
};

export function isAdmin(user: User | null | undefined): boolean {
  return !!user && ADMIN_ROLES.includes(user.role);
}

export function isSuperAdmin(user: User | null | undefined): boolean {
  return user?.role === "super_admin";
}

/** Whether the user can manage an admin area. The server enforces the same rule. */
export function can(user: User | null | undefined, permission: Permission): boolean {
  return !!user && user.permissions.includes(permission);
}

/** Who can open a page: everyone, any admin, the super admin, or admins with a permission. */
export type Access = "everyone" | "admin" | "super_admin" | Permission;

export function canAccess(user: User, access: Access): boolean {
  if (access === "everyone") return true;
  if (access === "admin") return isAdmin(user);
  if (access === "super_admin") return isSuperAdmin(user);
  return can(user, access);
}

export function roleLabel(user: User): string {
  if (user.role === "super_admin") return "Super admin";
  if (user.role === "admin") return "Admin";
  return "Listener";
}

/** Admins land on the dashboard; listeners go straight to the player. */
export function landingPath(user: User): string {
  return isAdmin(user) ? "/dashboard" : "/listen";
}
