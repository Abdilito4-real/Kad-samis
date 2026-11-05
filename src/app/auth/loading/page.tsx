"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { KadsamisLoader } from "@/components/auth/KadsamisLoader";
import { canViewOverview, getRoleLandingPath } from "@/lib/roleLanding";

export default function AuthLoadingPage() {
  const router = useRouter();
  const { user, loading, initializationStage, initializationError, retryInitialization } = useAuth();

  useEffect(() => {
    if (loading || initializationError) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    const preferredView = window.localStorage.getItem("kadsamis-default-view");
    const destination = !canViewOverview(user.roleId)
      ? getRoleLandingPath(user.roleId)
      : preferredView === "assets"
        ? "/assets"
        : preferredView === "requests"
          ? "/requests"
          : user.roleId === "super_admin"
            ? "/dashboard"
            : user.organizationId
              ? `/dashboard?orgId=${encodeURIComponent(user.organizationId)}`
              : "/dashboard";

    router.replace(destination);
  }, [initializationError, loading, router, user]);

  if (initializationError) {
    return (
      <KadsamisLoader
        stage={initializationStage}
        error={initializationError}
        onRetry={() => void retryInitialization()}
        onSignIn={() => router.replace("/auth/login")}
      />
    );
  }

  return <KadsamisLoader stage={!loading && user ? "almost" : initializationStage} />;
}
