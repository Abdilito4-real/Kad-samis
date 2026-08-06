"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** Re-fetches the profile row for the current session — call after editing
   * something on the profile (e.g. username) so the rest of the app (sidebar,
   * dashboard greeting) picks up the change without a full page reload. */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface ProfileRow {
  id?: string | null;
  email?: string | null;
  username?: string | null;
  role?: string | null;
  organization_id?: string | null;
  created_at?: string | null;
}

function mapProfileToUser(profile: ProfileRow, fallbackId: string, fallbackEmail: string | null | undefined): User {
  return {
    id: profile.id ?? fallbackId,
    email: profile.email ?? fallbackEmail ?? "",
    username: profile.username ?? null,
    firstName: null,
    lastName: null,
    phone: null,
    avatarUrl: null,
    roleId: profile.role ?? "read_only_user",
    ministryId: null,
    departmentId: null,
    organizationId: profile.organization_id ?? null,
    isActive: true,
    lastLogin: null,
    createdAt: profile.created_at ?? new Date().toISOString(),
    updatedAt: profile.created_at ?? new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        setUser(null);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (error) {
        console.warn("Profile refresh failed:", error);
        return;
      }
      if (profile) {
        setUser(mapProfileToUser(profile as ProfileRow, authUser.id, authUser.email));
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
    }
  }, [supabase]);

  useEffect(() => {
    const getUser = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        // First, try to restore session from localStorage/cookies
        const {
          data: { session: existingSession },
        } = await supabase.auth.getSession();

        if (existingSession) {
          await refreshProfile();
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    if (!supabase) {
      return;
    }

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle();

          if (profile && !error) {
            setUser(mapProfileToUser(profile as ProfileRow, session.user.id, session.user.email));
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      listener?.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const signOut = async () => {
    if (!supabase) {
      setUser(null);
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
