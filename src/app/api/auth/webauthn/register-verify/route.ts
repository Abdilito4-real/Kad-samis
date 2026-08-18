import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { createServerSideClient } from "@/lib/supabase/server";
import { getSupabaseFromRequest } from "@/lib/supabase/serverHelpers";
import { getRpConfig, registrationChallenge, bytesToBase64Url } from "@/lib/webauthn";
import { describeUserAgent } from "@/lib/parseUserAgent";
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from "@/lib/rate-limit";

/**
 * Step 2 of adding a passkey: verify the browser's attestation against the
 * challenge issued by register-options, then store the credential.
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

    const body = await request.json().catch(() => null);
    if (!body?.response) {
      return NextResponse.json({ error: "Missing registration response" }, { status: 400 });
    }

    const expectedChallenge = await registrationChallenge.read();
    if (!expectedChallenge) {
      return NextResponse.json({ error: "Registration expired. Please try again." }, { status: 400 });
    }

    const { rpID, origin } = await getRpConfig();

    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    await registrationChallenge.clear();

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Passkey could not be verified" }, { status: 400 });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const deviceName =
      typeof body.deviceName === "string" && body.deviceName.trim()
        ? body.deviceName.trim().slice(0, 60)
        : describeUserAgent(request.headers.get("user-agent"));

    const { data: inserted, error: insertError } = await supabase
      .from("webauthn_credentials")
      .insert({
        user_id: user.id,
        credential_id: credential.id,
        public_key: bytesToBase64Url(credential.publicKey),
        counter: credential.counter,
        device_type: credentialDeviceType,
        backed_up: credentialBackedUp,
        transports: credential.transports ?? [],
        device_name: deviceName,
      })
      .select("id, device_name, created_at")
      .single();

    if (insertError) {
      console.error("webauthn credential insert failed", insertError);
      return NextResponse.json({ error: "Unable to save passkey" }, { status: 500 });
    }

    return NextResponse.json({ success: true, credential: inserted });
  } catch (error) {
    console.error("webauthn register-verify failed", error);
    return NextResponse.json({ error: "Unable to complete passkey registration" }, { status: 500 });
  }
}
