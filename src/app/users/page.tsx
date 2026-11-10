"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveGrid } from "@/components/layout/ResponsiveGrid";
import { MetricCard } from "@/components/layout/MetricCard";
import { ResponsiveList } from "@/components/layout/ResponsiveList";
import { AlertCircle, Loader2, Users2, ShieldCheck, UserPlus, Wrench, Plus, X, ChevronRight, Pencil, Check, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { displayIdentity } from "@/lib/displayIdentity";
import { MetricValueSkeleton } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  role: string | null;
  organization_id: string | null;
  created_at: string;
}

const formatRole = (role: string | null) => {
  if (role === "agency_admin" || role === "ministry_admin" || role === "department_head") {
    return "Organization Admin";
  }
  return (role || "read_only_user").replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
};

const ADMIN_ROLES = new Set(["super_admin", "agency_admin", "ministry_admin", "department_head"]);
const USERNAME_ROLES = new Set(["super_admin", "operational_manager"]);
const ORGANIZATION_STAFF_ROLES = [
  ["agency_admin", "Organization Admin"],
  ["mechanical_request_handler", "Mechanical Requests Operator"],
  ["electrical_mechanical_handler", "Electrical & Mechanical Requests Operator"],
  ["assistant_director_operations", "Assistant Director Operations"],
  ["director_operations", "Director Operations"],
  ["custodian", "Custodian"],
] as const;

function UserRowSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-24 shrink-0 rounded-full" />
    </div>
  );
}

function UserRow({
  user,
  onUsernameSaved,
  canManageRoles = false,
  canDelete = false,
  currentUserId,
  onRoleSaved,
  onUserDeleted,
}: {
  user: Profile;
  onUsernameSaved: (id: string, username: string) => void;
  canManageRoles?: boolean;
  canDelete?: boolean;
  currentUserId?: string;
  onRoleSaved?: (id: string, role: string) => void;
  onUserDeleted?: (id: string) => void;
}) {
  const isOperationalManager = user.role === "operational_manager";
  const usesUsername = user.role ? USERNAME_ROLES.has(user.role) : false;
  const [editing, setEditing] = useState(false);
  const [draftUsername, setDraftUsername] = useState(user.username ?? "");
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState(
    user.role === "ministry_admin" || user.role === "department_head" ? "agency_admin" : user.role ?? "agency_admin"
  );
  const [savingRole, setSavingRole] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const identity = displayIdentity(user);
    if (!window.confirm(`Permanently delete ${identity}? They will lose access, and this action cannot be undone.`)) return;

    setDeleting(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not initialized");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No authenticated session");

      const response = await fetch(`/api/admin/profiles/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + session.access_token },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete user");

      onUserDeleted?.(user.id);
      toast.success("User deleted", { description: `${identity} can no longer sign in.` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  const handleRoleChange = async (role: string) => {
    const previousRole = selectedRole;
    setSelectedRole(role);
    setSavingRole(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not initialized");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No authenticated session");

      const response = await fetch(`/api/admin/profiles/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify({ role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update user role");

      onRoleSaved?.(user.id, data.profile.role);
      toast.success(`${formatRole(user.role)} changed to ${formatRole(data.profile.role)}`);
    } catch (error) {
      setSelectedRole(previousRole);
      toast.error(error instanceof Error ? error.message : "Failed to update user role");
    } finally {
      setSavingRole(false);
    }
  };

  const handleSave = async () => {
    if (!draftUsername.trim()) {
      toast.error("Username can't be empty");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not initialized");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No authenticated session");

      const response = await fetch(`/api/admin/profiles/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ username: draftUsername.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save username");

      onUsernameSaved(user.id, data.profile.username);
      setEditing(false);
      toast.success("Username saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save username");
    } finally {
      setSaving(false);
    }
  };

  const identityBlock = (
    <div className="min-w-0 flex-1">
      {editing ? (
        <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
          <Input
            autoFocus
            value={draftUsername}
            onChange={(e) => setDraftUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Username"
            className="h-8 max-w-[200px]"
          />
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={saving} onClick={handleSave}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={saving} onClick={() => { setEditing(false); setDraftUsername(user.username ?? ""); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="min-w-0 flex-1 truncate font-medium">{displayIdentity(user)}</p>
          {usesUsername && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setEditing(true);
              }}
              className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label={user.username ? "Edit username" : "Set username"}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {usesUsername && !user.username && !editing && (
        <p className="text-xs text-amber-600 dark:text-amber-400">No username set — showing email for now</p>
      )}
      <p className="text-sm text-muted-foreground">
        {formatRole(user.role)}
        {isOperationalManager
          ? " · Global role"
          : user.organization_id
            ? ` · Organization ${user.organization_id}`
            : " · No organization assigned"}
      </p>
      {isOperationalManager && (
        <p className="mt-0.5 text-xs text-muted-foreground">View assigned requests and their stages</p>
      )}
      {canManageRoles && user.id !== currentUserId && (
        <div className="mt-3 w-full max-w-sm space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
          <label htmlFor={`role-${user.id}`} className="block text-sm font-semibold">
            Change this user’s role
          </label>
          <select
            id={`role-${user.id}`}
            value={selectedRole}
            disabled={savingRole}
            onChange={(event) => void handleRoleChange(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            {ORGANIZATION_STAFF_ROLES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {savingRole && <p className="text-xs text-muted-foreground">Saving role…</p>}
        </div>
      )}
    </div>
  );

  const badge = (
    <div className="flex shrink-0 items-center gap-2">
      <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
        {user.role === "super_admin" ? "System-wide" : isOperationalManager ? "Operations" : "Active profile"}
      </span>
      {isOperationalManager && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </div>
  );

  if (isOperationalManager) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/operations?operatorId=${user.id}&operatorEmail=${encodeURIComponent(displayIdentity(user))}`}
          className="flex min-w-0 flex-1 flex-col gap-2 transition sm:flex-row sm:items-center sm:justify-between"
          onClick={(e) => editing && e.preventDefault()}
        >
          {identityBlock}
          {badge}
        </Link>
        {canDelete && user.id !== currentUserId && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void handleDelete()}
            disabled={deleting}
            aria-label={`Delete ${displayIdentity(user)}`}
            title="Delete user"
            className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      {identityBlock}
      <div className="flex items-center justify-between gap-2">
        {badge}
        {canDelete && user.id !== currentUserId && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void handleDelete()}
            disabled={deleting}
            aria-label={`Delete ${displayIdentity(user)}`}
            title="Delete user"
            className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roleId === "super_admin";
  const isOrganizationAdmin = Boolean(user?.roleId && ["agency_admin", "ministry_admin", "department_head"].includes(user.roleId));
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingOperator, setAddingOperator] = useState(false);
  const [operatorUsername, setOperatorUsername] = useState("");
  const [operatorEmail, setOperatorEmail] = useState("");
  const [operatorPassword, setOperatorPassword] = useState("");
  const [savingOperator, setSavingOperator] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffRole, setStaffRole] = useState<(typeof ORGANIZATION_STAFF_ROLES)[number][0]>("mechanical_request_handler");
  const [savingStaff, setSavingStaff] = useState(false);

  const authHeaders = async () => {
    const supabase = createClient();
    if (!supabase) throw new Error("Supabase client not initialized");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No authenticated session. Please sign in again.");
    return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const headers = await authHeaders();
      const response = await fetch("/api/admin/profiles", { headers, cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load users");
      }

      setUsers(data.profiles ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUsernameSaved = (id: string, username: string) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, username } : u)));
  };

  const handleRoleSaved = (id: string, role: string) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
  };

  const handleUserDeleted = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const handleAddOperator = async () => {
    if (!operatorUsername.trim()) {
      toast.error("Username is required for Operational Managers");
      return;
    }
    if (!operatorEmail.trim() || !/\S+@\S+\.\S+/.test(operatorEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!operatorPassword || operatorPassword.length < 8) {
      toast.error("Set a temporary password of at least 8 characters");
      return;
    }

    setSavingOperator(true);
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/admin/profiles", {
        method: "POST",
        headers,
        body: JSON.stringify({
          username: operatorUsername.trim(),
          email: operatorEmail.trim(),
          password: operatorPassword,
          role: "operational_manager",
          organization_id: null,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to add Operational Manager");

      setUsers((prev) => [data.profile, ...prev]);
      setOperatorUsername("");
      setOperatorEmail("");
      setOperatorPassword("");
      setAddingOperator(false);
      toast.success("Operational Manager added", {
        description: "Share the temporary password with them securely. They can change it after signing in.",
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to add Operational Manager");
    } finally {
      setSavingOperator(false);
    }
  };

  const handleAddStaff = async () => {
    if (!staffEmail.trim() || !/\S+@\S+\.\S+/.test(staffEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (staffPassword.length < 8) {
      toast.error("Set a temporary password of at least 8 characters");
      return;
    }

    setSavingStaff(true);
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/admin/profiles", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: staffEmail.trim(),
          password: staffPassword,
          role: staffRole,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create user");

      setUsers((prev) => [data.profile, ...prev]);
      setStaffEmail("");
      setStaffPassword("");
      setStaffRole("mechanical_request_handler");
      setAddingStaff(false);
      toast.success("User created", {
        description: "Share the temporary password securely. The user can change it after signing in.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSavingStaff(false);
    }
  };

  const operationalManagers = useMemo(() => users.filter((u) => u.role === "operational_manager"), [users]);
  const administrators = useMemo(() => users.filter((u) => u.role && ADMIN_ROLES.has(u.role)), [users]);
  const otherStaff = useMemo(
    () => users.filter((u) => u.role !== "operational_manager" && !(u.role && ADMIN_ROLES.has(u.role))),
    [users]
  );

  const protectedRoles = useMemo(
    () => new Set(users.filter((user) => user.role && user.role !== "read_only_user").map((user) => user.role)).size,
    [users]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{isOrganizationAdmin ? "Organization Users" : "Users"}</h1>
          <p className="text-muted-foreground">
            {isOrganizationAdmin
              ? "Create staff accounts for your organization and assign their responsibilities."
              : "Govern access and accountability across ministries and departments."}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
          <UserPlus className="h-4 w-4" /> User provisioning uses Supabase Auth
        </div>
      </div>

      <ResponsiveGrid cols={{ base: 1, md: 3, xl: 3 }}>
        {[
          { title: "Profiles", value: users.length, icon: Users2 },
          { title: "Assigned roles", value: protectedRoles, icon: ShieldCheck },
          { title: "Organizations represented", value: new Set(users.map((user) => user.organization_id).filter(Boolean)).size, icon: UserPlus },
        ].map((item) => (
          <MetricCard key={item.title} title={item.title} value={loading ? <MetricValueSkeleton /> : item.value} icon={item.icon} />
        ))}
      </ResponsiveGrid>

      {isOrganizationAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Organization staff</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                New users are restricted to your organization. Create the replacement Org Admin before changing the current admin’s role.
              </p>
            </div>
            <Button size="sm" onClick={() => setAddingStaff((value) => !value)} className="gap-2">
              {addingStaff ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {addingStaff ? "Cancel" : "Create user"}
            </Button>
          </CardHeader>
          {addingStaff && (
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="staff-email">Email address</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    value={staffEmail}
                    onChange={(event) => setStaffEmail(event.target.value)}
                    placeholder="staff@example.gov.ng"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-role">Role</Label>
                  <select
                    id="staff-role"
                    value={staffRole}
                    onChange={(event) => setStaffRole(event.target.value as typeof staffRole)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {ORGANIZATION_STAFF_ROLES.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-password">Temporary password</Label>
                  <Input
                    id="staff-password"
                    type="password"
                    value={staffPassword}
                    onChange={(event) => setStaffPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button onClick={handleAddStaff} isLoading={savingStaff} loadingText="Creating user">
                  Create user
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {isSuperAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Operational Managers</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {operationalManagers.length} active · a global role, not tied to a single organization, that drives
                approved maintenance/repair requests through completion.
              </p>
            </div>
            {!addingOperator && (
              <Button size="sm" onClick={() => setAddingOperator(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Operational Manager
              </Button>
            )}
          </CardHeader>
          {addingOperator && (
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="operator-username">Username</Label>
                  <Input
                    id="operator-username"
                    placeholder="e.g. j.operations"
                    value={operatorUsername}
                    onChange={(e) => setOperatorUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="operator-email">Email address</Label>
                  <Input
                    id="operator-email"
                    type="email"
                    placeholder="operations@example.com"
                    value={operatorEmail}
                    onChange={(e) => setOperatorEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="operator-password">Temporary password</Label>
                  <Input
                    id="operator-password"
                    type="text"
                    placeholder="At least 8 characters"
                    value={operatorPassword}
                    onChange={(e) => setOperatorPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setAddingOperator(false); setOperatorUsername(""); setOperatorEmail(""); setOperatorPassword(""); }}
                  disabled={savingOperator}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button onClick={handleAddOperator} isLoading={savingOperator} loadingText="Add" className="gap-2">
                  <Wrench className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardContent>
          )}
          {!error && (
            <CardContent className={addingOperator ? "pt-0" : undefined}>
              {loading ? (
                <ResponsiveList>
                  {Array.from({ length: 2 }).map((_, index) => (
                    <UserRowSkeleton key={index} />
                  ))}
                </ResponsiveList>
              ) : operationalManagers.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No Operational Managers yet.</p>
              ) : (
                <ResponsiveList>
                  {operationalManagers.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onUsernameSaved={handleUsernameSaved}
                      canDelete={isSuperAdmin}
                      currentUserId={user?.id}
                      onUserDeleted={handleUserDeleted}
                    />
                  ))}
                </ResponsiveList>
              )}
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Administrators</CardTitle>
          <p className="text-sm text-muted-foreground">General Admin and organization-scoped admins (agency, ministry, department).</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ResponsiveList>
              {Array.from({ length: 3 }).map((_, index) => (
                <UserRowSkeleton key={index} />
              ))}
            </ResponsiveList>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500"><AlertCircle className="h-4 w-4" /> {error}</div>
          ) : administrators.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No administrators were found.</p>
          ) : (
            <ResponsiveList>
              {administrators.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  onUsernameSaved={handleUsernameSaved}
                  canManageRoles={isOrganizationAdmin}
                  canDelete={isSuperAdmin || isOrganizationAdmin}
                  currentUserId={user?.id}
                  onRoleSaved={handleRoleSaved}
                  onUserDeleted={handleUserDeleted}
                />
              ))}
            </ResponsiveList>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Other staff</CardTitle>
          <p className="text-sm text-muted-foreground">Asset, maintenance, procurement, finance, and other non-admin roles.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ResponsiveList>
              {Array.from({ length: 3 }).map((_, index) => (
                <UserRowSkeleton key={index} />
              ))}
            </ResponsiveList>
          ) : error ? null : otherStaff.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No other staff profiles were found.</p>
          ) : (
            <ResponsiveList>
              {otherStaff.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  onUsernameSaved={handleUsernameSaved}
                  canManageRoles={isOrganizationAdmin}
                  canDelete={isSuperAdmin || isOrganizationAdmin}
                  currentUserId={user?.id}
                  onRoleSaved={handleRoleSaved}
                  onUserDeleted={handleUserDeleted}
                />
              ))}
            </ResponsiveList>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
