import { MODULES, type PermissionAction } from "@/lib/modules";

export type { PermissionAction };

export type PermissionSnapshot = {
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type AccessUser = {
  id: string;
  name: string;
  email: string;
  role: {
    id: string;
    name: string;
    isAdmin: boolean;
    permissions: PermissionSnapshot[];
  };
};

export function can(user: AccessUser, module: string, action: PermissionAction) {
  if (user.role.isAdmin) return true;
  const row = user.role.permissions.find((permission) => permission.module === module);
  if (!row) return false;
  if (action === "view") return row.canView;
  if (action === "create") return row.canCreate;
  if (action === "edit") return row.canEdit;
  return row.canDelete;
}

export function firstAllowedHref(user: AccessUser) {
  for (const item of MODULES) {
    if (can(user, item.key, "view")) return item.href;
  }
  return "/profile";
}

export function emptyPermissions(): PermissionSnapshot[] {
  return MODULES.map((item) => ({
    module: item.key,
    canView: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
  }));
}
