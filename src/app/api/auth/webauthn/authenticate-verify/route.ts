import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getRpConfig, authenticationChallenge, base64UrlToBytes } from "@/lib/webauthn";
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from "@/lib/rate-limit";

/**
 * Step 2 of passkey sign-in — verifies the assertion, then mints a real
 * Supabase session for the credential's owner via the stable admin
 * `generateLink` API (a magic-link token the caller never emails, just
 * exchanges immediately via `supabase.auth.verifyOtp` — see
 * src/lib/webauthn-client.ts). This is public/unauthenticated by nature:
 * proving control of the passkey *is* the authentication.
 */
export async function POST(request: Request) {
  try {
    const identifier = getClientIdentifier(request);
    const rate = await checkRateLimit("auth-sensitive", identifier);
    if (!rate.success) {
      return rateLimitResponse(rate);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      // Passkey sign-in cannot work without the service role — minting a
      // session for an unauthenticated caller has to run with elevated
      // privileges, there's no lesser-privileged fallback like other
      // routes in this app have.
      return NextResponse.json({ error: "Passkey sign-in is not configured on this server" }, { status: 500 });
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await request.json().catch(() => null);
    const response = body?.response;
    if (!response?.id) {
      return NextResponse.json({ error: "Missing sign-in response" }, { status: 400 });
    }

    const expectedChallenge = await authenticationChallenge.read();
    if (!expectedChallenge) {
      return NextResponse.json({ error: "Sign-in attempt expired. Please try again." }, { status: 400 });
    }

    const { data: credentialRow, error: lookupError } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("id, user_id, credential_id, public_key, counter, transports")
      .eq("credential_id", response.id)
      .maybeSingle();

    if (lookupError || !credentialRow) {
      await authenticationChallenge.clear();
      return NextResponse.json({ error: "Passkey not recognized. Please sign in with your password." }, { status: 400 });
    }

    const { rpID, origin } = await getRpConfig();

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: credentialRow.credential_id,
        publicKey: base64UrlToBytes(credentialRow.public_key),
        counter: credentialRow.counter,
        transports: (credentialRow.transports ?? undefined) as any,
      },
    });

    await authenticationChallenge.clear();

    if (!verification.verified) {
      return NextResponse.json({ error: "Passkey could not be verified" }, { status: 400 });
    }

    await supabaseAdmin
      .from("webauthn_credentials")
      .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
      .eq("id", credentialRow.id);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", credentialRow.user_id)
      .maybeSingle();

    if (profileError || !profile?.email) {
      return NextResponse.json({ error: "Unable to sign in with this passkey" }, { status: 500 });
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("webauthn generateLink failed", linkError);
      return NextResponse.json({ error: "Unable to sign in with this passkey" }, { status: 500 });
    }

    return NextResponse.json({ email: profile.email, tokenHash: linkData.properties.hashed_token });
  } catch (error) {
    console.error("webauthn authenticate-verify failed", error);
    return NextResponse.json({ error: "Unable to complete passkey sign-in" }, { status: 500 });
  }
}
