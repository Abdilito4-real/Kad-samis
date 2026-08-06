/**
 * super_admin and operational_manager accounts are identified by username
 * throughout the UI instead of email (email remains the actual Supabase
 * Auth login credential — this is purely a display-layer choice). Every
 * other role keeps showing email as before. Falls back to email when a
 * qualifying account hasn't had a username set yet.
 */
export function displayIdentity(
  entity: { email?: string | null; username?: string | null; role?: string | null } | null | undefined
): string {
  if (!entity) return "Unknown";
  const usesUsername = entity.role === "super_admin" || entity.role === "operational_manager";
  if (usesUsername && entity.username) return entity.username;
  return entity.email || "Unknown";
}
