"use client";

// Client-side brute-force speed bump for the password sign-in form, scoped
// per email address so guessing wrong passwords against one account locks
// out attempts on *that* account without penalizing someone else signing
// in from the same browser. This is a UX/deterrence layer, not a security
// boundary — Supabase's GoTrue service does the real server-side rate
// limiting on signInWithPassword (see SECURITY.md); clearing localStorage
// (or using another browser/device) bypasses this instantly. What it adds:
// clear "too many attempts, wait Xs" feedback instead of letting someone
// mash the button indefinitely, plus a real (if bypassable) delay between
// guesses, with the wait growing each time a lockout is hit again.

const STORAGE_PREFIX = "kadsamis-login-attempts:";
const MAX_ATTEMPTS = 5;
const BASE_COOLDOWN_MS = 30_000; // 30s
const MAX_COOLDOWN_MS = 5 * 60_000; // cap the exponential backoff at 5 min

interface AttemptState {
  count: number; // failed attempts since the last lockout was cleared
  lockouts: number; // how many times this email has been locked out — drives backoff
  lockedUntil: number | null;
}

const EMPTY_STATE: AttemptState = { count: 0, lockouts: 0, lockedUntil: null };

function keyFor(email: string) {
  return `${STORAGE_PREFIX}${email.trim().toLowerCase()}`;
}

function readState(email: string): AttemptState {
  if (typeof window === "undefined" || !email.trim()) return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(keyFor(email));
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw);
    return {
      count: Number(parsed.count) || 0,
      lockouts: Number(parsed.lockouts) || 0,
      lockedUntil: typeof parsed.lockedUntil === "number" ? parsed.lockedUntil : null,
    };
  } catch {
    return EMPTY_STATE;
  }
}

function writeState(email: string, state: AttemptState) {
  if (typeof window === "undefined" || !email.trim()) return;
  try {
    window.localStorage.setItem(keyFor(email), JSON.stringify(state));
  } catch {
    // Storage disabled (private browsing etc.) — the lockout just won't
    // persist across reloads, which is a safe degradation.
  }
}

export interface LockoutStatus {
  /** Epoch ms the lockout ends, or null if not currently locked. */
  lockedUntil: number | null;
  attemptsRemaining: number;
}

/** Current status for `email` — call on mount and whenever the email field changes. */
export function getLockoutStatus(email: string): LockoutStatus {
  const state = readState(email);
  const stillLocked = Boolean(state.lockedUntil && state.lockedUntil > Date.now());
  return {
    lockedUntil: stillLocked ? state.lockedUntil : null,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - state.count),
  };
}

/** Call after a failed sign-in attempt for `email`. Returns the resulting lockout status. */
export function recordFailedAttempt(email: string): LockoutStatus {
  const state = readState(email);

  // An already-expired lockout starts the count fresh instead of
  // compounding forever on attempts from a previous, already-served wait.
  if (state.lockedUntil && state.lockedUntil <= Date.now()) {
    state.count = 0;
    state.lockedUntil = null;
  }

  state.count += 1;

  if (state.count >= MAX_ATTEMPTS) {
    const cooldownMs = Math.min(BASE_COOLDOWN_MS * 2 ** state.lockouts, MAX_COOLDOWN_MS);
    state.lockedUntil = Date.now() + cooldownMs;
    state.lockouts += 1;
    state.count = 0;
  }

  writeState(email, state);
  return {
    lockedUntil: state.lockedUntil,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - state.count),
  };
}

/** Call after a successful sign-in — clears the slate for this email. */
export function clearLoginAttempts(email: string) {
  if (typeof window === "undefined" || !email.trim()) return;
  try {
    window.localStorage.removeItem(keyFor(email));
  } catch {
    // no-op — nothing to clean up if storage isn't available.
  }
}
