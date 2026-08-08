"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/components/auth-provider";

const SESSION_KEY = "kadsamis-splash-shown";
// A splash that vanishes the instant auth resolves reads as a flicker, not
// a launch screen — Instagram/Facebook hold theirs for a beat even on a
// warm cache. This is that floor, not a fixed delay: it races against
// `useAuth().loading` and whichever finishes last wins.
const MIN_VISIBLE_MS = 900;

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return standaloneMedia || iosStandalone;
}

/**
 * App-open splash screen for the installed PWA — logo + brand loader over
 * the dark brand gradient used elsewhere (login/landing "product" panels),
 * shown once per browser session on cold start when running standalone
 * (home-screen icon tap), never on an ordinary browser tab. Internal route
 * navigations never remount the root layout, so this naturally never
 * reappears mid-session even without the sessionStorage guard — the guard
 * exists for the case where `loading` is already `false` by the time this
 * mounts (a fast warm reload), so a second cold start in the same tab
 * session doesn't replay it either.
 */
export function AppSplash() {
  const { loading: authLoading } = useAuth();
  const [shouldRender, setShouldRender] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    if (!isStandaloneDisplay()) return;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(SESSION_KEY)) return;

    setShouldRender(true);
    window.sessionStorage.setItem(SESSION_KEY, "1");

    const timer = window.setTimeout(() => setMinTimeElapsed(true), MIN_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const visible = shouldRender && (!minTimeElapsed || authLoading);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="app-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[linear-gradient(160deg,_#06120e,_#0b2a22_45%,_#0f172a)]"
          aria-hidden
        >
          {/* Soft ambient glow, same radial treatment as the landing hero's
              product panel, so the launch screen and the app itself feel
              like one visual system. */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,_rgba(16,185,129,0.18),_transparent_55%)]" />

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative flex flex-col items-center"
          >
            <div className="relative flex h-24 w-24 items-center justify-center">
              {/* Two staggered pulse rings around the mark — the same idea
                  as Instagram/Facebook's launch pulse, built from plain CSS
                  keyframes (see globals.css) instead of a Lottie/gif asset. */}
              <span className="absolute inset-0 rounded-full border border-emerald-400/30 animate-splash-pulse" />
              <span className="absolute inset-0 rounded-full border border-emerald-400/30 animate-splash-pulse [animation-delay:0.6s]" />
              <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[22px] border border-white/15 bg-white/5 shadow-[0_8px_40px_rgba(16,185,129,0.25)] backdrop-blur">
                <Image
                  src="/images/auth/kaduna-state.png"
                  alt="Kadsamis"
                  width={80}
                  height={80}
                  priority
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <p className="mt-6 text-lg font-semibold tracking-[0.35em] text-white">KADSAMIS</p>
            <p className="mt-1 text-xs font-medium tracking-[0.2em] text-emerald-300/80">KADUNA STATE DIGITAL PORTAL</p>

            <div className="mt-8 flex items-center gap-1.5" role="status" aria-label="Loading">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-splash-dot [animation-delay:0s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-splash-dot [animation-delay:0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-splash-dot [animation-delay:0.3s]" />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
