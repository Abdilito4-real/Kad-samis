const ORGANIZATION_ADMIN_ROLES = new Set(["agency_admin", "ministry_admin", "department_head"]);

export function canViewOverview(roleId?: string | null): boolean {
  return roleId === "super_admin" || Boolean(roleId && ORGANIZATION_ADMIN_ROLES.has(roleId));
}

export function getRoleLandingPath(roleId?: string | null): string {
  if (canViewOverview(roleId)) return "/dashboard";
  if (roleId === "operational_manager") return "/operations";
  if (roleId === "mechanical_request_handler" || roleId === "electrical_mechanical_handler" || roleId === "maintenance_officer") {
    return "/requests";
  }
  if (roleId === "inspector") return "/inspections";
  return "/assets";
}
