import { cookies, headers } from "next/headers";

// Supabase's own Auth server has a very new, still-experimental native
// passkey API (`supabase.auth.signInWithPasskey`/`registerPasskey`) — but it
// requires the project's GoTrue server to have that feature enabled, which
// isn't something this app can detect or rely on. This module instead
// implements WebAuthn directly against @simplewebauthn (industry-standard,
// works against any Supabase project) and, once a passkey assertion is
// verified, mints a real Supabase session via the stable, long-standing
// admin `generateLink` + `verifyOtp` combination — see
// src/app/api/auth/webauthn/authenticate-verify/route.ts.

const CHALLENGE_TTL_SECONDS = 5 * 60;

export const REGISTRATION_CHALLENGE_COOKIE = "kadsamis_webauthn_reg_challenge";
export const AUTHENTICATION_CHALLENGE_COOKIE = "kadsamis_webauthn_auth_challenge";

/**
 * Relying Party config, derived per-request so this works unmodified across
 * localhost dev, preview deployments, and production — with an explicit env
 * override for when the app sits behind a proxy that doesn't forward
 * `host`/`x-forwarded-proto` cleanly.
 */
export async function getRpConfig() {
  const hdrs = await headers();
  const host = process.env.WEBAUTHN_ORIGIN ? new URL(process.env.WEBAUTHN_ORIGIN).host : hdrs.get("host") || "localhost";
  const proto = process.env.WEBAUTHN_ORIGIN
    ? new URL(process.env.WEBAUTHN_ORIGIN).protocol.replace(":", "")
    : hdrs.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const hostname = host.split(":")[0];

  return {
    rpID: process.env.WEBAUTHN_RP_ID || hostname,
    rpName: process.env.WEBAUTHN_RP_NAME || "Kadsamis",
    origin: process.env.WEBAUTHN_ORIGIN || `${proto}://${host}`,
  };
}

async function setChallengeCookie(name: string, challenge: string) {
  const store = await cookies();
  store.set(name, challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
  });
}

async function readChallengeCookie(name: string) {
  const store = await cookies();
  return store.get(name)?.value ?? null;
}

async function clearChallengeCookie(name: string) {
  const store = await cookies();
  store.delete(name);
}

export const registrationChallenge = {
  set: (challenge: string) => setChallengeCookie(REGISTRATION_CHALLENGE_COOKIE, challenge),
  read: () => readChallengeCookie(REGISTRATION_CHALLENGE_COOKIE),
  clear: () => clearChallengeCookie(REGISTRATION_CHALLENGE_COOKIE),
};

export const authenticationChallenge = {
  set: (challenge: string) => setChallengeCookie(AUTHENTICATION_CHALLENGE_COOKIE, challenge),
  read: () => readChallengeCookie(AUTHENTICATION_CHALLENGE_COOKIE),
  clear: () => clearChallengeCookie(AUTHENTICATION_CHALLENGE_COOKIE),
};

// --- base64url <-> Uint8Array, for storing/loading the public key -------
// simplewebauthn works with raw bytes; Postgres text column stores it as
// base64url so it round-trips exactly (no padding/charset surprises).

export function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  // A Node `Buffer` is a `Uint8Array<ArrayBufferLike>` (its backing buffer
  // *could* be a `SharedArrayBuffer`), which doesn't structurally satisfy
  // @simplewebauthn/server's `Uint8Array_` (= `Uint8Array<ArrayBuffer>`)
  // under TS's generic typed-array types — even though `Buffer.from(string,
  // encoding)` always allocates a fresh, non-shared `ArrayBuffer` in
  // practice. Copying byte-by-byte into a plain `Uint8Array` sidesteps the
  // type-checker ambiguity entirely rather than fighting it with a cast.
  const buffer = Buffer.from(value, "base64url");
  const bytes = new Uint8Array(buffer.length);
  bytes.set(buffer);
  return bytes;
}
