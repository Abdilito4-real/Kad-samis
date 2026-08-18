"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { logSignIn } from "@/lib/logSignIn";
import { setKeepSignedIn } from "@/lib/sessionPersistence";
import { clearLoginAttempts, getLockoutStatus, recordFailedAttempt } from "@/lib/loginAttempts";
import {
  hasEnrolledPasskeyOnThisDevice,
  isMobileDevice,
  signInWithPasskey,
  supportsBiometricSignIn,
} from "@/lib/webauthn-client";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { toast } from "sonner";

export default function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Defaults to true so a user who never touches the checkbox gets this
  // app's original always-persist behavior.
  const [keepSignedIn, setKeepSignedInState] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Password-attempt lockout — see src/lib/loginAttempts.ts. Re-checked
  // whenever the email field changes so switching accounts doesn't inherit
  // a different email's cooldown.
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  // Drives the full-panel "Confirm it's you" takeover on capable mobile
  // devices — replaces the password form until the auto-triggered ceremony
  // resolves (success navigates away regardless) or fails/gets cancelled,
  // at which point it reverts to the normal form as a fallback.
  const [autoGateVisible, setAutoGateVisible] = useState(false);
  // Guards the mount effect's auto-prompt so React 18 Strict Mode's
  // dev-only double-invoke (or any other remount) can't fire a second
  // biometric ceremony on top of one already in flight.
  const autoTriedRef = useRef(false);

  const supabase = useMemo(() => createClient(), []);

  /** Shared by both the password and passkey paths — once a session
   * exists, the rest of "finish signing in" is identical either way. */
  const completeSignIn = async (accessToken: string, userId: string, method: "password" | "passkey") => {
    if (!supabase) return;

    const { error: profileError } = await supabase
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.warn("Profile lookup after login failed", profileError);
    }

    logSignIn(accessToken, method);

    toast.success("Signed in successfully", {
      description: "Preparing your secure workspace…",
    });
    window.setTimeout(() => router.push("/auth/loading"), 900);
  };

  /** `silent` suppresses the failure toast — used by the mobile
   * auto-prompt, since the user never asked for that particular attempt;
   * it should just fall back to the visible form instead of greeting an
   * unsolicited page load with a red error. The manually-clicked button
   * still gets normal error feedback. Returns whether sign-in succeeded so
   * callers can decide what to do next. */
  const handlePasskeyLogin = async (opts?: { silent?: boolean }): Promise<boolean> => {
    if (!supabase) return false;
    setBiometricLoading(true);
    setError(null);

    try {
      // No "keep me signed in" checkbox exists on this path — a biometric
      // sign-in is inherently the fast-reauth convenience flow, so it
      // always persists like this app's original behavior did.
      setKeepSignedIn(true);
      const session = await signInWithPasskey(supabase);
      await completeSignIn(session.access_token, session.user.id, "passkey");
      return true;
    } catch (err: any) {
      const message = err?.message || "Passkey sign-in failed";
      // A cancelled biometric prompt isn't an error worth alarming over —
      // the user just changed their mind or backed out.
      if (!opts?.silent && !/cancelled/i.test(message)) {
        toast.error("Unable to sign in with passkey", { description: message });
      }
      return false;
    } finally {
      setBiometricLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);

    let cancelled = false;

    // Show the manual button whenever this device *can* do platform
    // biometrics, regardless of whether passkey registration happened in
    // this exact browser: a discoverable/usernameless WebAuthn prompt
    // handles "nothing enrolled here" gracefully with its own native "no
    // passkey available" UI, so gating visibility on the local
    // hasEnrolledPasskeyOnThisDevice() marker was hiding a working button
    // whenever the passkey was registered on a different device/browser or
    // arrived here via a synced passkey provider (iCloud Keychain, Google
    // Password Manager) rather than local registration.
    supportsBiometricSignIn().then((available) => {
      if (cancelled) return;
      setBiometricAvailable(available);

      // The *unprompted auto-fire* on load stays gated on the local
      // enrollment marker — that's the one place a doomed native prompt
      // popping unasked on a first-time visitor would actually be
      // annoying, as opposed to a button they choose to tap themselves.
      if (!available || !isMobileDevice() || !hasEnrolledPasskeyOnThisDevice() || autoTriedRef.current) return;
      autoTriedRef.current = true;

      (async () => {
        setAutoGateVisible(true);
        // Let the "Confirm it's you" gate paint before the native
        // biometric sheet steals focus — a Face ID/fingerprint dialog
        // appearing over a half-loaded page reads as broken, not
        // deliberate.
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        if (cancelled) return;

        const succeeded = await handlePasskeyLogin({ silent: true });
        if (!cancelled && !succeeded) setAutoGateVisible(false);
      })();
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const message = searchParams.get("message");
    if (message) {
      setSuccessMessage(decodeURIComponent(message));
      toast.success("Password reset successful", {
        description: "Please sign in with your new password.",
      });
    }
  }, [searchParams]);

  // Re-check this email's lockout status whenever it changes, so switching
  // accounts in the field doesn't carry over a different email's cooldown.
  useEffect(() => {
    setLockedUntil(getLockoutStatus(email).lockedUntil);
  }, [email]);

  // Ticks the lockout countdown once a second and clears it when it expires.
  useEffect(() => {
    if (!lockedUntil) {
      setLockoutSecondsLeft(0);
      return;
    }
    const tick = () => {
      const secondsLeft = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setLockoutSecondsLeft(secondsLeft);
      if (secondsLeft <= 0) setLockedUntil(null);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    // Checked fresh (not just from state) in case the countdown effect
    // hasn't ticked over yet at the exact moment of submit.
    const status = getLockoutStatus(email);
    if (status.lockedUntil) {
      setLockedUntil(status.lockedUntil);
      const secondsLeft = Math.max(0, Math.ceil((status.lockedUntil - Date.now()) / 1000));
      const message = `Too many failed attempts. Please wait ${secondsLeft}s before trying again.`;
      setError(message);
      toast.error("Too many attempts", { description: message });
      return;
    }

    setLoading(true);

    if (!supabase) {
      const fallback = "Supabase is not configured. Please check environment variables.";
      setError(fallback);
      toast.error("Unable to sign in", {
        description: fallback,
      });
      setLoading(false);
      return;
    }

    try {
      setKeepSignedIn(keepSignedIn);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        const attempt = recordFailedAttempt(email);
        setLockedUntil(attempt.lockedUntil);

        if (attempt.lockedUntil) {
          const secondsLeft = Math.max(0, Math.ceil((attempt.lockedUntil - Date.now()) / 1000));
          const message = `Too many failed attempts. Please wait ${secondsLeft}s before trying again.`;
          setError(message);
          toast.error("Too many attempts", { description: message });
        } else {
          const attemptsNote =
            attempt.attemptsRemaining <= 2
              ? ` (${attempt.attemptsRemaining} attempt${attempt.attemptsRemaining === 1 ? "" : "s"} left before a temporary lockout)`
              : "";
          setError(`${signInError.message}${attemptsNote}`);
          toast.error("Unable to sign in", {
            description: `${signInError.message}${attemptsNote}`,
          });
        }
      } else if (!data?.session) {
        const fallback = "Unable to establish session. Please try again.";
        setError(fallback);
        toast.error("Unable to sign in", { description: fallback });
      } else {
        const { data: { session: activeSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !activeSession) {
          throw new Error(sessionError?.message || "Session was not created");
        }

        clearLoginAttempts(email);
        await completeSignIn(activeSession.access_token, activeSession.user.id, "password");
      }
    } catch (_error) {
      const fallback = "An unexpected error occurred";
      setError(fallback);
      toast.error("Sign-in failed", { description: fallback });
    } finally {
      setLoading(false);
    }
  };

  const isLocked = lockedUntil !== null && lockoutSecondsLeft > 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.14),_transparent_25%),linear-gradient(135deg,_#f8fafc,_#eef5f8)] transition-colors dark:bg-background dark:bg-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.16),_transparent_35%)] dark:bg-[radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.08),_transparent_35%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-border bg-card/90 shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr]"
        >
          {/* Brand panel — intentionally a fixed dark surface regardless of
              site theme, like most government/enterprise login screens. */}
          <div className="hidden min-w-0 flex-col justify-between bg-[linear-gradient(160deg,_#06120e,_#0b2a22_45%,_#0f172a)] p-8 text-white lg:flex">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-slate-200">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Secure government access
              </div>
              <h1 className="mt-8 text-4xl font-semibold leading-tight">
                Trusted digital access for public asset operations.
              </h1>
              <p className="mt-4 max-w-md text-sm text-slate-300">
                Unified workflows for ministries, departments, maintenance teams, and inspectors.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
                  <Image
                    src="/images/auth/kaduna-state.png"
                    alt="Kaduna State government facilities management illustration"
                    width={600}
                    height={96}
                    className="h-24 w-full rounded-2xl object-cover"
                  />
                  <div className="p-3 text-sm text-slate-200">
                    <p className="font-medium text-white">Kaduna State Government</p>
                    <p className="mt-1 text-xs text-slate-400">Modern public asset oversight</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
                  <Image
                    src="/images/auth/kadfama.png"
                    alt="KADFAMA facilities management agency illustration"
                    width={600}
                    height={96}
                    className="h-24 w-full rounded-2xl object-cover"
                  />
                  <div className="p-3 text-sm text-slate-200">
                    <p className="font-medium text-white">KADFAMA</p>
                    <p className="mt-1 text-xs text-slate-400">Agency-led facilities coordination</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-slate-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  Role-aware navigation and protected workflows are ready.
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 p-4 sm:p-8 lg:p-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-border bg-background shadow-sm sm:h-12 sm:w-12">
                  <Image src="/images/auth/kaduna-state.png" alt="Kaduna State logo" width={48} height={48} priority className="h-full w-full rounded-2xl object-cover" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-foreground sm:text-xl">Kadsamis</h2>
                  <p className="truncate text-xs text-muted-foreground sm:text-sm">Government asset management</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="shrink-0 rounded-full border border-border bg-background p-2 text-muted-foreground shadow-sm transition hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-500"
                aria-label="Toggle theme"
              >
                {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>

            <div className="mt-4 rounded-[24px] border border-border bg-background/60 p-4 shadow-sm sm:mt-8 sm:p-6">
              <div className="space-y-1.5 sm:space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Welcome back</p>
                <h3 className="text-xl font-semibold text-foreground sm:text-2xl">Secure portal access</h3>
                <p className="hidden text-sm text-muted-foreground sm:block">
                  Sign in to continue with ministry workflows, inspections, and approvals.
                </p>
              </div>

              {autoGateVisible ? (
                <div className="mt-4 flex flex-col items-center gap-4 rounded-[24px] border border-emerald-400/20 bg-emerald-500/5 px-6 py-10 text-center sm:mt-6">
                  <div className="relative flex h-16 w-16 items-center justify-center">
                    {/* Same pulse-ring language as the app-open splash
                        (app-splash.tsx) — one visual system for "the app is
                        doing something biometric right now". */}
                    <span className="absolute inset-0 rounded-full border border-emerald-400/40 animate-splash-pulse" />
                    <span className="absolute inset-0 rounded-full border border-emerald-400/40 animate-splash-pulse [animation-delay:0.6s]" />
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                      <Fingerprint className="h-7 w-7" />
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">Confirm it&apos;s you</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Use Face ID or your fingerprint to sign in to Kadsamis.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5" role="status" aria-label="Waiting for biometric confirmation">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-splash-dot [animation-delay:0s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-splash-dot [animation-delay:0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-splash-dot [animation-delay:0.3s]" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoGateVisible(false)}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Use email &amp; password instead
                  </button>
                </div>
              ) : (
                <>
                  {biometricAvailable ? (
                    <div className="mt-4 space-y-3 sm:mt-6">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2 border-emerald-400/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                        onClick={() => handlePasskeyLogin()}
                        isLoading={biometricLoading}
                        loadingText="Verifying…"
                      >
                        <Fingerprint className="h-4 w-4" />
                        Sign in with Face ID / Touch ID
                      </Button>
                      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span className="h-px flex-1 bg-border" />
                        or use your password
                        <span className="h-px flex-1 bg-border" />
                      </div>
                    </div>
                  ) : null}

                  <form onSubmit={handleLogin} className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
                    {successMessage ? (
                      <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-500">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        {successMessage}
                      </div>
                    ) : null}

                    {isLocked ? (
                      <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-600">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                        Too many failed attempts. Try again in {lockoutSecondsLeft}s.
                      </div>
                    ) : error ? (
                      <div className="flex items-start gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-3 text-sm text-rose-500">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        {error}
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Email address</label>
                      <div className="flex items-center gap-2 rounded-2xl border border-input bg-background px-3 py-2.5 transition focus-within:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-400/20">
                        <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@example.com"
                          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
                          required
                          disabled={isLocked}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Password</label>
                      <div className="flex items-center gap-2 rounded-2xl border border-input bg-background px-3 py-2.5 transition focus-within:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-400/20">
                        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
                          required
                          disabled={isLocked}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="shrink-0 text-muted-foreground transition hover:text-foreground"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={keepSignedIn}
                          onChange={(event) => setKeepSignedInState(event.target.checked)}
                          className="rounded border-input accent-emerald-500"
                        />
                        Keep me signed in
                      </label>
                      <Link href="/auth/forgot-password" className="font-medium text-primary hover:underline">
                        Forgot password?
                      </Link>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      isLoading={loading}
                      loadingText="Signing in…"
                      disabled={isLocked}
                    >
                      {isLocked ? (
                        <span className="flex items-center justify-center gap-2">
                          <Clock className="h-4 w-4" />
                          Try again in {lockoutSecondsLeft}s
                        </span>
                      ) : (
                        "Sign in"
                      )}
                    </Button>
                  </form>
                </>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm text-muted-foreground sm:mt-6 sm:pt-4">
                <Link href="/" className="font-medium text-primary hover:underline">
                  Back to home
                </Link>
                <span className="hidden sm:inline">Support • System status • Version 1.0.0</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
