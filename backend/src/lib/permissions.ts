/**
 * Areas of the admin dashboard that can be delegated to sub-admins (role
 * "admin"). The super admin always has every permission and is the only one
 * who can manage other admins.
 */
export const PERMISSIONS = ["station", "listeners", "integrations"] as const;
export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}

export function effectivePermissions(user: { role: string; permissions?: string[] | null }): Permission[] {
  if (user.role === "super_admin") return [...PERMISSIONS];
  if (user.role !== "admin") return [];
  return (user.permissions ?? []).filter(isPermission);
}
