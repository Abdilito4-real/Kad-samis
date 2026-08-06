"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

interface UserOrgStatus {
  userId: string;
  email: string | null;
  role: string | null;
  organizationId: string | null;
  hasOrganization: boolean;
  message: string;
}

interface UserOrgEntry {
  id: string;
  email: string | null;
  role: string | null;
  organizationId: string | null;
  organizationName: string | null;
  hasOrganization: boolean;
  assetCount: number;
  canSeeAssets: boolean;
  message: string;
}

interface Organization {
  id: string;
  name: string;
}

export default function UserOrgDebugPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<UserOrgStatus | null>(null);
  const [users, setUsers] = useState<UserOrgEntry[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setLoading(false);
      router.replace("/auth/login");
      return;
    }

    let isCancelled = false;

    const checkStatus = async () => {
      try {
        const response = await fetch("/api/admin/check-user-org");
        const data = await response.json();

        if (isCancelled) return;

        if (response.ok) {
          setStatus(data.currentUser ?? null);
          setUsers(data.users ?? []);
        } else if (response.status === 401) {
          setStatus({
            userId: user.id,
            email: user.email ?? null,
            role: user.roleId ?? null,
            organizationId: user.organizationId ?? null,
            hasOrganization: Boolean(user.organizationId),
            message: "Authenticated in the browser, but the server session was unavailable. Showing the local account state instead.",
          });
          setUsers([]);
        } else {
          toast.error(data.error || "Failed to check status");
        }
      } catch (err) {
        if (isCancelled) return;
        console.error("Failed to check user org:", err);
        toast.error("Failed to check organization status");
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    const fetchOrganizations = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        if (!supabase) {
          console.error("Supabase client not available");
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) return;

        const response = await fetch("/api/admin/organizations", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (!isCancelled) {
            setOrganizations(data.organizations || []);
          }
        }
      } catch (err) {
        if (isCancelled) return;
        console.error("Failed to fetch organizations:", err);
      }
    };

    checkStatus();
    fetchOrganizations();

    return () => {
      isCancelled = true;
    };
  }, [authLoading, user, router]);

  const handleAssignOrganization = async () => {
    if (!selectedOrgId) {
      toast.error("Please select an organization");
      return;
    }

    setAssigning(true);
    try {
      const response = await fetch("/api/admin/check-user-org", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ organizationId: selectedOrgId }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Assigned to ${data.organizationName}`);
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                organizationId: selectedOrgId,
                hasOrganization: true,
                message: `✅ Assigned to ${data.organizationName}`,
              }
            : null
        );
        // Redirect to assets after short delay
        setTimeout(() => router.push("/assets"), 1500);
      } else {
        toast.error(data.error || "Failed to assign organization");
      }
    } catch (err) {
      console.error("Failed to assign organization:", err);
      toast.error("Failed to assign organization");
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Checking organization status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-8 shadow-lg">
          <h1 className="text-3xl font-bold mb-2">Organization Assignment</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Users need to be assigned to an organization to view and manage assets.
          </p>

          {status && (
            <div
              className={`rounded-2xl p-6 mb-8 flex gap-4 ${
                status.hasOrganization
                  ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"
                  : "bg-orange-50 border border-orange-200 dark:bg-orange-900/20 dark:border-orange-800"
              }`}
            >
              <div>
                {status.hasOrganization ? (
                  <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold mb-1">{status.message}</p>
                <div className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
                  <p>
                    <strong>Email:</strong> {status.email}
                  </p>
                  <p>
                    <strong>Role:</strong> {status.role}
                  </p>
                  <p>
                    <strong>Organization:</strong>{" "}
                    {status.organizationId || "Not assigned"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {users.length > 0 && (
            <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800">
                User organization overview
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                  <thead className="bg-white dark:bg-slate-900">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">User</th>
                      <th className="px-4 py-3 text-left font-medium">Organization</th>
                      <th className="px-4 py-3 text-left font-medium">Role</th>
                      <th className="px-4 py-3 text-left font-medium">Assets visible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
                    {users.map((userEntry) => (
                      <tr key={userEntry.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{userEntry.email || "—"}</div>
                          <div className="text-xs text-slate-500">{userEntry.id}</div>
                        </td>
                        <td className="px-4 py-3">{userEntry.organizationName || "Not assigned"}</td>
                        <td className="px-4 py-3">{userEntry.role || "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              userEntry.canSeeAssets
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                            }`}
                          >
                            {userEntry.canSeeAssets ? `Yes (${userEntry.assetCount})` : "No"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!status?.hasOrganization && organizations.length > 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Organization
                </label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- Choose an organization --</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={handleAssignOrganization}
                disabled={!selectedOrgId || assigning}
                className="w-full"
                size="lg"
              >
                {assigning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  "Assign to Organization"
                )}
              </Button>
            </div>
          )}

          {status?.hasOrganization && (
            <Button
              onClick={() => router.push("/assets")}
              className="w-full"
              size="lg"
            >
              Go to Assets
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
            className="w-full mt-3"
          >
            Back to Dashboard
          </Button>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-6">
          <h3 className="font-semibold mb-3">Why do I need an organization?</h3>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <li>
              ✓ <strong>Data Security:</strong> RLS policies ensure you can only
              see assets belonging to your organization
            </li>
            <li>
              ✓ <strong>Access Control:</strong> Organization assignment enables
              role-based permissions
            </li>
            <li>
              ✓ <strong>Compliance:</strong> Meets government data protection
              requirements
            </li>
            <li>
              ✓ <strong>Audit Trail:</strong> Database-level tracking of all
              asset access
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
