"use client";

import { AlertCircle, Landmark, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuthInitializationStage } from "@/components/auth-provider";

type LoaderStage = AuthInitializationStage | "almost";

const stageMessages: Record<LoaderStage, string> = {
  verifying: "Verifying your account",
  profile: "Loading your ministry profile",
  workspace: "Preparing your workspace",
  almost: "Almost there",
  idle: "Preparing your workspace",
};

interface KadsamisLoaderProps {
  stage: LoaderStage;
  error?: string | null;
  onRetry?: () => void;
  onSignIn?: () => void;
}

export function KadsamisLoader({ stage, error, onRetry, onSignIn }: KadsamisLoaderProps) {
  return (
    <main
      className="auth-loader-background flex min-h-screen min-h-[100svh] items-center justify-center overflow-hidden px-4 py-8 sm:px-6"
      aria-busy={!error}
    >
      <section
        className="auth-loader-card relative w-full max-w-md rounded-[28px] border border-white/80 bg-white/90 p-7 text-center shadow-[0_24px_80px_-32px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:p-10"
        aria-labelledby="auth-loader-title"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-900/5">
          {error ? (
            <AlertCircle className="h-7 w-7" aria-hidden="true" />
          ) : (
            <Landmark className="auth-loader-emblem h-7 w-7" strokeWidth={1.7} aria-hidden="true" />
          )}
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
          Kaduna State Government
        </p>
        <p className="mt-2 text-sm font-bold tracking-[0.2em] text-slate-800">KADSAMIS</p>
        <h1 id="auth-loader-title" className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
          {error ? "We couldn’t prepare your workspace" : "Your ministry awaits."}
        </h1>

        {error ? (
          <>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">{error}</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button type="button" onClick={onRetry} className="gap-2">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Try again
              </Button>
              <Button type="button" variant="outline" onClick={onSignIn}>
                Return to sign in
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Securely connecting you to the services and information you need.
            </p>
            <div className="mt-8">
              <div className="auth-loader-progress-track" aria-hidden="true">
                <span className="auth-loader-progress-bar" />
              </div>
              <p className="mt-3 flex min-h-5 items-center justify-center gap-2 text-sm font-medium text-slate-600" role="status" aria-live="polite">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-700 motion-reduce:animate-none" aria-hidden="true" />
                <span>{stageMessages[stage]}</span>
              </p>
            </div>
            <p className="mt-8 border-t border-slate-100 pt-5 text-xs text-slate-500">
              A secure workspace for Kaduna State ministries and agencies
            </p>
          </>
        )}
      </section>
    </main>
  );
}
