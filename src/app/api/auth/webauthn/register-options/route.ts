import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { createServerSideClient } from "@/lib/supabase/server";
import { getSupabaseFromRequest } from "@/lib/supabase/serverHelpers";
import { getRpConfig, registrationChallenge } from "@/lib/webauthn";
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from "@/lib/rate-limit";

/**
 * Step 1 of adding a passkey: generate a WebAuthn registration challenge for
 * the signed-in user. Requires an existing session — passkeys are added
 * from within Settings after a normal password sign-in, never used to
 * create an account.
 */
export async function POST(request: Request) {
  try {
    const identifier = getClientIdentifier(request);
    const rate = await checkRateLimit("write", identifier);
    if (!rate.success) {
      return rateLimitResponse(rate);
    }

    const supabase = getSupabaseFromRequest(request) ?? (await createServerSideClient());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, username")
      .eq("id", user.id)
      .maybeSingle();

    const { data: existingCredentials } = await supabase
      .from("webauthn_credentials")
      .select("credential_id, transports")
      .eq("user_id", user.id);

    const { rpID, rpName } = await getRpConfig();

    const options = await generateRegistrationOptions({
      rpID,
      rpName,
      userID: new TextEncoder().encode(user.id),
      userName: profile?.username || profile?.email || user.email || "Kadsamis user",
      userDisplayName: profile?.username || profile?.email || user.email || "Kadsamis user",
      attestationType: "none",
      excludeCredentials: (existingCredentials ?? []).map((row: { credential_id: string; transports: string[] | null }) => ({
        id: row.credential_id,
        transports: (row.transports ?? undefined) as any,
      })),
      // 'platform' scopes this to the device's built-in biometric/PIN
      // authenticator (Face ID, Touch ID, Windows Hello, Android
      // fingerprint) — the "biometric sign-in" this feature is for, rather
      // than also offering roaming USB security keys.
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        userVerification: "required",
      },
    });

    await registrationChallenge.set(options.challenge);

    return NextResponse.json({ options });
  } catch (error) {
    console.error("webauthn register-options failed", error);
    return NextResponse.json({ error: "Unable to start passkey registration" }, { status: 500 });
  }
}
