"use client";

import { useMemo, useState, type FormEvent, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Clock, KeyRound, Loader2, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const supabase = useMemo(() => createClient(), []);

  // Track rate limit cooldown
  useEffect(() => {
    const lastResetTime = localStorage.getItem("last_password_reset_time");
    if (lastResetTime) {
      const timeSinceReset = Date.now() - parseInt(lastResetTime);
      const remainingSeconds = Math.max(0, 60 - Math.floor(timeSinceReset / 1000));
      if (remainingSeconds > 0) {
        setCooldownSeconds(remainingSeconds);
      }
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setTimeout(() => setCooldownSeconds(cooldownSeconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!supabase) {
      const fallback = "Supabase is not configured. Please check environment variables.";
      setError(fallback);
      toast.error("Unable to send reset link", { description: fallback });
      setLoading(false);
      return;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) {
        console.error("Password reset error:", resetError);
        
        // Handle rate limit
        if (resetError.message?.includes("rate limit")) {
          setError("Too many requests. Please try again in 1 minute.");
          setCooldownSeconds(60);
          localStorage.setItem("last_password_reset_time", Date.now().toString());
          toast.error("Rate limited", { description: "Please wait before requesting another reset" });
        } else {
          setError(`Unable to send reset email: ${resetError.message}`);
          toast.error("Reset email failed", { description: resetError.message });
        }
      } else {
        setMessage("If the email exists, a password reset link has been sent.");
        localStorage.setItem("last_password_reset_time", Date.now().toString());
        setCooldownSeconds(60);
        toast.success("Password reset request sent");
        setEmail("");
      }
    } catch (err: any) {
      console.error("Forgot password request failed:", err);
      setError(`Error: ${err?.message || "Unknown error"}`);
      toast.error("Password reset failed", { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.14),_transparent_25%),linear-gradient(135deg,_#f8fafc,_#eef5f8)] px-4 py-12 transition-colors dark:bg-background dark:bg-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.16),_transparent_35%)] dark:bg-[radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.08),_transparent_35%)]" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mx-auto w-full max-w-md rounded-3xl border border-border bg-card/90 p-8 shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground">Forgot your password?</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we’ll send you a secure link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {cooldownSeconds > 0 ? (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
              <Clock className="h-4 w-4 shrink-0" />
              Please wait {cooldownSeconds} seconds before requesting another reset email.
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {message}
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email address
            </label>
            <div className="flex items-center gap-2 rounded-2xl border border-input bg-background px-3 py-2.5 transition focus-within:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-400/20">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || cooldownSeconds > 0}
          >
            {cooldownSeconds > 0 ? (
              <span className="flex items-center justify-center gap-2">
                <Clock className="h-4 w-4" />
                Wait {cooldownSeconds}s to retry
              </span>
            ) : loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending link…
              </span>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
