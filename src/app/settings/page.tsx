"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sun, Moon, User as UserIcon, KeyRound, LayoutDashboard, Loader2, Save, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { displayIdentity } from "@/lib/displayIdentity";
import { PushNotificationsCard } from "@/components/notifications/PushNotificationsCard";
import { cn } from "@/lib/utils";

const USERNAME_ROLES = new Set(["super_admin", "operational_manager"]);

const formatRole = (role: string | null | undefined) =>
  (role || "read_only_user").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const DEFAULT_VIEW_KEY = "kadsamis-default-view";

export default function SettingsPage() {
  const { user, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const usesUsername = user?.roleId ? USERNAME_ROLES.has(user.roleId) : false;
  const [username, setUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  const [defaultView, setDefaultView] = useState("dashboard");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem(DEFAULT_VIEW_KEY);
    if (stored) setDefaultView(stored);
  }, []);

  useEffect(() => {
    setUsername(user?.username ?? "");
  }, [user?.username]);

  const handleSaveUsername = async () => {
    if (!user) return;
    if (!username.trim()) {
      toast.error("Username can't be empty");
      return;
    }

    setSavingUsername(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not initialized");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No authenticated session");

      const response = await fetch(`/api/admin/profiles/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save username");

      await refreshProfile();
      toast.success("Username saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save username");
    } finally {
      setSavingUsername(false);
    }
  };

  const handleDefaultViewChange = (value: string) => {
    setDefaultView(value);
    window.localStorage.setItem(DEFAULT_VIEW_KEY, value);
    toast.success("Landing page updated", { description: "Applies the next time you sign in." });
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setChangingPassword(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not initialized");

      // Re-authenticate with the current password first — updateUser alone
      // would let anyone with a live session change the password without
      // proving they know the current one.
      if (user?.email) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (reauthError) throw new Error("Current password is incorrect");
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your profile, appearance, and account security.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Role</CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatRole(user?.roleId)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Theme</CardTitle>
            {mounted && theme === "dark" ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{mounted ? (theme === "dark" ? "Dark" : "Light") : "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Signed in as</CardTitle>
            <UserIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="truncate text-2xl font-semibold">{user ? displayIdentity({ email: user.email, username: user.username, role: user.roleId }) : "—"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserIcon className="h-4 w-4" /> Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input value={user?.email ?? ""} disabled readOnly />
              <p className="text-xs text-muted-foreground">Your email is your sign-in credential and cannot be changed here.</p>
            </div>
            {usesUsername && (
              <div className="space-y-2">
                <Label htmlFor="settings-username">Username</Label>
                <div className="flex gap-2">
                  <Input
                    id="settings-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Set a username"
                  />
                  <Button onClick={handleSaveUsername} disabled={savingUsername || username.trim() === (user?.username ?? "")} className="shrink-0 gap-2">
                    {savingUsername ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Shown across KAD-SAMIS instead of your email, since {formatRole(user?.roleId).toLowerCase()} accounts are identified by username.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sun className="h-4 w-4" /> Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-2xl border border-border bg-background/70 p-4">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">Light is the default for every new sign-in — switch anytime, it stays remembered on this device.</p>
            </div>
            <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  mounted && theme === "light" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                <Sun className="h-4 w-4" /> Light
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  mounted && theme === "dark" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                <Moon className="h-4 w-4" /> Dark
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutDashboard className="h-4 w-4" /> Notifications & landing page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PushNotificationsCard />
          <label className="flex items-center justify-between rounded-2xl border border-border bg-background/70 p-4">
            <div>
              <p className="font-medium">Landing page after sign-in</p>
              <p className="text-sm text-muted-foreground">Where KAD-SAMIS takes you right after you log in.</p>
            </div>
            <select
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              value={defaultView}
              onChange={(event) => handleDefaultViewChange(event.target.value)}
            >
              <option value="dashboard">Dashboard</option>
              <option value="assets">Assets</option>
              <option value="requests">Requests</option>
            </select>
          </label>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Change your password. You will need to confirm your current one first.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
            </div>
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="gap-2"
          >
            {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Update password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
