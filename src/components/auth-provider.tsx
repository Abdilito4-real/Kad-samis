"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/types";

export type AuthInitializationStage = "verifying" | "profile" | "workspace" | "idle";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  initializationStage: AuthInitializationStage;
  initializationError: string | null;
  retryInitialization: () => Promise<void>;
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

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function getInitializationError(error: unknown): string {
  if (error instanceof Error && error.message.includes("timed out")) {
    return error.message;
  }
  return "We couldn't finish loading your account. Check your connection and try again.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializationStage, setInitializationStage] = useState<AuthInitializationStage>("verifying");
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const attemptRef = useRef(0);
  const userRef = useRef<User | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const updateUser = useCallback((nextUser: User | null) => {
    userRef.current = nextUser;
    setUser(nextUser);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        updateUser(null);
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
        updateUser(mapProfileToUser(profile as ProfileRow, authUser.id, authUser.email));
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
    }
  }, [supabase, updateUser]);

  const retryInitialization = useCallback(async () => {
    const attempt = ++attemptRef.current;
    setLoading(true);
    setInitializationError(null);
    setInitializationStage("verifying");

    if (!supabase) {
      setInitializationError("Authentication is unavailable. Check your connection and try again.");
      setInitializationStage("idle");
      setLoading(false);
      return;
    }

    let initialized = false;
    try {
      const { data, error } = await withTimeout(
        supabase.auth.getSession(),
        15000,
        "Account verification timed out. Check your connection and try again."
      );
      if (attempt !== attemptRef.current) return;
      if (error) throw error;

      const authUser = data.session?.user;
      if (!authUser) {
        updateUser(null);
        setInitializationStage("idle");
        return;
      }

      setInitializationStage("profile");
      const { data: profile, error: profileError } = await withTimeout(
        supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
        15000,
        "Loading your ministry profile timed out. Check your connection and try again."
      );
      if (attempt !== attemptRef.current) return;
      if (profileError) throw profileError;
      if (!profile) throw new Error("Your ministry profile could not be found.");

      setInitializationStage("workspace");
      updateUser(mapProfileToUser(profile as ProfileRow, authUser.id, authUser.email));
      initialized = true;
    } catch (error) {
      if (attempt !== attemptRef.current) return;
      console.error("Account initialization failed:", error);
      updateUser(null);
      setInitializationError(getInitializationError(error));
    } finally {
      if (attempt === attemptRef.current) {
        setLoading(false);
        if (!initialized) setInitializationStage("idle");
      }
    }
  }, [supabase, updateUser]);

  useEffect(() => {
    void retryInitialization();
    if (!supabase) return;

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "INITIAL_SESSION") return;
      if (!session?.user) {
        attemptRef.current += 1;
        updateUser(null);
        setInitializationError(null);
        setInitializationStage("idle");
        setLoading(false);
        return;
      }

      if (event !== "SIGNED_IN" && userRef.current?.id === session.user.id) return;

      const attempt = ++attemptRef.current;
      setLoading(true);
      setInitializationError(null);
      setInitializationStage("profile");
      try {
        const { data: profile, error } = await withTimeout(
          supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
          15000,
          "Loading your ministry profile timed out. Check your connection and try again."
        );
        if (attempt !== attemptRef.current) return;
        if (error) throw error;
        if (!profile) throw new Error("Your ministry profile could not be found.");
        setInitializationStage("workspace");
        updateUser(mapProfileToUser(profile as ProfileRow, session.user.id, session.user.email));
      } catch (error) {
        if (attempt !== attemptRef.current) return;
        console.error("Account profile initialization failed:", error);
        updateUser(null);
        setInitializationError(getInitializationError(error));
      } finally {
        if (attempt === attemptRef.current) setLoading(false);
      }
    });

    return () => {
      attemptRef.current += 1;
      listener?.subscription.unsubscribe();
    };
  }, [retryInitialization, supabase, updateUser]);

  const signOut = async () => {
    if (!supabase) {
      updateUser(null);
      return;
    }

    await supabase.auth.signOut();
    updateUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        initializationStage,
        initializationError,
        retryInitialization,
        signOut,
        refreshProfile,
      }}
    >
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
