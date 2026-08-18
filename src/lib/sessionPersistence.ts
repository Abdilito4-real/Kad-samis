"use client";

// Backs the login page's "Keep me signed in" checkbox. The preference
// itself always lives in localStorage (it has to survive the tab closing
// to mean anything), but it controls *where the Supabase session token
// gets written* — see the storage adapter in supabase/client.ts.

const KEEP_SIGNED_IN_KEY = "kadsamis-keep-signed-in";

/** Call right before signing in (password or passkey) so the Supabase
 * client's storage adapter picks the right backing store for the session
 * it's about to receive. Defaults to `true` (persist to localStorage) if
 * never called — matches this app's original always-localStorage behavior
 * for anyone who signs in via a flow with no checkbox (e.g. passkey). */
export function setKeepSignedIn(keep: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEEP_SIGNED_IN_KEY, keep ? "1" : "0");
  } catch {
    // Storage disabled (private browsing etc.) — falls back to the
    // default of "persist," which is the safer failure mode for not
    // surprising a returning user with an unexpected logout.
  }
}

export function getKeepSignedIn(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(KEEP_SIGNED_IN_KEY) !== "0";
  } catch {
    return true;
  }
}
