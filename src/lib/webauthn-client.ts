"use client";

import type { SupabaseClient, Session } from "@supabase/supabase-js";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";

// Tracks, per-device, whether *this* browser has ever completed passkey
// registration — a resident-key passkey only ever lives on the device it
// was created on, so this is a reasonable local signal for "the login
// page's biometric button has something to actually offer here" without
// an extra round trip before the page can decide whether to show it.
// Deliberately not the source of truth (the server always re-verifies via
// the actual WebAuthn ceremony) — just avoids showing a dead-end button on
// a device that's never enrolled one.
const ENROLLED_CREDENTIAL_KEY = "kadsamis-passkey-credential-id";

/** Records the id of the credential row this exact device just created —
 * both "a passkey is enrolled here" (any value present) and precisely
 * which row, so removing that specific credential elsewhere in the app can
 * accurately un-mark this device instead of guessing. */
export function markPasskeyEnrolled(credentialRowId: string) {
  try {
    window.localStorage.setItem(ENROLLED_CREDENTIAL_KEY, credentialRowId);
  } catch {
    // Private browsing / storage disabled — the button just won't
    // pre-show on this device, which is a safe degradation.
  }
}

/** Clears the local enrollment marker only if `credentialRowId` is the one
 * this device recorded — removing a passkey that lives on a *different*
 * device (shown in the same Settings list) must not hide this device's own
 * biometric sign-in button. */
export function clearPasskeyEnrolledIfMatches(credentialRowId: string) {
  try {
    if (window.localStorage.getItem(ENROLLED_CREDENTIAL_KEY) === credentialRowId) {
      window.localStorage.removeItem(ENROLLED_CREDENTIAL_KEY);
    }
  } catch {
    // See markPasskeyEnrolled.
  }
}

export function hasEnrolledPasskeyOnThisDevice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage.getItem(ENROLLED_CREDENTIAL_KEY));
  } catch {
    return false;
  }
}

/** True only when this browser can do WebAuthn *and* has a platform
 * authenticator (Face ID/Touch ID/Windows Hello/Android biometrics) — the
 * combination "biometric sign-in" actually needs. A browser that supports
 * WebAuthn but has no biometric hardware would otherwise show a button that
 * falls through to a USB-key prompt, which isn't what was promised. */
export async function supportsBiometricSignIn(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!browserSupportsWebAuthn()) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

/** UA-based, not viewport-width-based — a narrow desktop window has no
 * fingerprint sensor to auto-prompt regardless of how the layout responds,
 * so gating the auto-biometric login flow on screen size alone would just
 * pop a dialog that's guaranteed to fail. Same iPadOS caveat as the rest of
 * this codebase's device sniffing (src/hooks/use-install-prompt.ts): iPadOS
 * Safari's UA impersonates desktop macOS by default, so an iPad won't match
 * here even though it has Touch ID/Face ID — acceptable for now since the
 * ask was specifically phones. */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

async function authedFetch(url: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || "Request failed");
  }
  return json;
}

/** Registers this device's biometric authenticator as a passkey for the
 * signed-in user. Throws with a message safe to show the user (either the
 * server's error or a friendly fallback for a cancelled/failed ceremony). */
export async function registerPasskey(accessToken: string, deviceName?: string) {
  const { options } = await authedFetch("/api/auth/webauthn/register-options", accessToken, { method: "POST" });

  let response;
  try {
    response = await startRegistration({ optionsJSON: options });
  } catch (err: any) {
    if (err?.name === "InvalidStateError") {
      throw new Error("This device is already registered as a passkey.");
    }
    if (err?.name === "NotAllowedError") {
      throw new Error("Passkey setup was cancelled.");
    }
    throw new Error("Your device couldn't complete passkey setup.");
  }

  const result = await authedFetch("/api/auth/webauthn/register-verify", accessToken, {
    method: "POST",
    body: JSON.stringify({ response, deviceName }),
  });

  if (result?.credential?.id) {
    markPasskeyEnrolled(result.credential.id);
  }

  return result;
}

export interface WebAuthnCredentialSummary {
  id: string;
  device_name: string;
  created_at: string;
  last_used_at: string | null;
}

export async function listPasskeys(accessToken: string): Promise<WebAuthnCredentialSummary[]> {
  const { credentials } = await authedFetch("/api/auth/webauthn/credentials", accessToken);
  return credentials ?? [];
}

export async function removePasskey(accessToken: string, id: string) {
  const result = await authedFetch(`/api/auth/webauthn/credentials?id=${encodeURIComponent(id)}`, accessToken, {
    method: "DELETE",
  });
  clearPasskeyEnrolledIfMatches(id);
  return result;
}

/** Signs in with a passkey — usernameless: the platform shows an account
 * picker for whichever passkeys are enrolled on this device for this
 * origin, no email or password entry needed. The server only ever verifies
 * the WebAuthn assertion and hands back a one-time magic-link token; this
 * function does the actual session exchange through the same Supabase
 * client the rest of the app uses, so the resulting session persists to
 * localStorage exactly like a password sign-in does. */
export async function signInWithPasskey(supabase: SupabaseClient): Promise<Session> {
  const optionsRes = await fetch("/api/auth/webauthn/authenticate-options", { method: "POST" });
  const optionsJson = await optionsRes.json().catch(() => ({}));
  if (!optionsRes.ok) {
    throw new Error(optionsJson?.error || "Unable to start passkey sign-in");
  }

  let response;
  try {
    response = await startAuthentication({ optionsJSON: optionsJson.options });
  } catch (err: any) {
    if (err?.name === "NotAllowedError") {
      throw new Error("Passkey sign-in was cancelled.");
    }
    throw new Error("Your device couldn't complete passkey sign-in.");
  }

  const verifyRes = await fetch("/api/auth/webauthn/authenticate-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response }),
  });
  const verifyJson = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok || !verifyJson?.email || !verifyJson?.tokenHash) {
    throw new Error(verifyJson?.error || "Passkey sign-in failed");
  }

  // Supabase's verifyOtp is strict about this: the token_hash form and the
  // raw-6-digit-code form are mutually exclusive, and passing `email`
  // alongside `token_hash` throws "Only the token_hash and type should be
  // provided" instead of signing in.
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: verifyJson.tokenHash,
    type: "magiclink",
  });

  if (error || !data.session) {
    throw new Error(error?.message || "Unable to establish session");
  }

  return data.session;
}
