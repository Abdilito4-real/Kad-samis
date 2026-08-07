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
import { AlertCircle, Loader2, Users2, ShieldCheck, UserPlus, Wrench, Plus, X, ChevronRight, Pencil, Check } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { displayIdentity } from "@/lib/displayIdentity";

interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  role: string | null;
  organization_id: string | null;
  created_at: string;
}

const formatRole = (role: string | null) =>
  (role || "read_only_user").replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

const ADMIN_ROLES = new Set(["super_admin", "agency_admin", "ministry_admin", "department_head"]);
const USERNAME_ROLES = new Set(["super_admin", "operational_manager"]);

function UserRow({ user, onUsernameSaved }: { user: Profile; onUsernameSaved: (id: string, username: string) => void }) {
  const isOperationalManager = user.role === "operational_manager";
  const usesUsername = user.role ? USERNAME_ROLES.has(user.role) : false;
  const [editing, setEditing] = useState(false);
  const [draftUsername, setDraftUsername] = useState(user.username ?? "");
  const [saving, setSaving] = useState(false);

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
    <div className="min-w-0">
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
        <div className="flex items-center gap-1.5">
          <p className="font-medium truncate">{displayIdentity(user)}</p>
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
      <Link
        href={`/operations?operatorId=${user.id}&operatorEmail=${encodeURIComponent(displayIdentity(user))}`}
        className="flex flex-col gap-2 rounded-2xl border border-border bg-background/70 p-4 transition hover:border-primary/40 hover:bg-primary/5 sm:flex-row sm:items-center sm:justify-between"
        onClick={(e) => editing && e.preventDefault()}
      >
        {identityBlock}
        {badge}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      {identityBlock}
      {badge}
    </div>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roleId === "super_admin";
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingOperator, setAddingOperator] = useState(false);
  const [operatorUsername, setOperatorUsername] = useState("");
  const [operatorEmail, setOperatorEmail] = useState("");
  const [operatorPassword, setOperatorPassword] = useState("");
  const [savingOperator, setSavingOperator] = useState(false);

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
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Users</h1>
          <p className="text-muted-foreground">Govern access and accountability across ministries and departments.</p>
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
          <MetricCard key={item.title} title={item.title} value={loading ? "-" : item.value} icon={item.icon} />
        ))}
      </ResponsiveGrid>

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
                <Button onClick={handleAddOperator} disabled={savingOperator} className="gap-2">
                  {savingOperator ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                  Add
                </Button>
              </div>
            </CardContent>
          )}
          {!loading && !error && (
            <CardContent className={addingOperator ? "pt-0" : undefined}>
              {operationalManagers.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No Operational Managers yet.</p>
              ) : (
                <ResponsiveList>
                  {operationalManagers.map((u) => (
                    <UserRow key={u.id} user={u} onUsernameSaved={handleUsernameSaved} />
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
          <p className="text-sm text-muted-foreground">Super Admin and org-scoped admins (agency, ministry, department).</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading users...</div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500"><AlertCircle className="h-4 w-4" /> {error}</div>
          ) : administrators.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No administrators were found.</p>
          ) : (
            <ResponsiveList>
              {administrators.map((u) => (
                <UserRow key={u.id} user={u} onUsernameSaved={handleUsernameSaved} />
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
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading users...</div>
          ) : error ? null : otherStaff.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No other staff profiles were found.</p>
          ) : (
            <ResponsiveList>
              {otherStaff.map((u) => (
                <UserRow key={u.id} user={u} onUsernameSaved={handleUsernameSaved} />
              ))}
            </ResponsiveList>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
