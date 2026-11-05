"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KadsamisLoader } from "@/components/auth/KadsamisLoader";
import { useAuth } from "@/components/auth-provider";

export function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    user,
    loading,
    initializationStage,
    initializationError,
    retryInitialization,
  } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading || initializationError) return;

    setReady(true);
    if (!user) {
      router.replace("/auth/login");
    }
  }, [initializationError, loading, user, router]);

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

  if (loading || !ready) {
    return <KadsamisLoader stage={initializationStage} />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
