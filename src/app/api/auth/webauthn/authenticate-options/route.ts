import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getRpConfig, authenticationChallenge } from "@/lib/webauthn";
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from "@/lib/rate-limit";

/**
 * Step 1 of passkey sign-in — public (no session yet). Deliberately
 * usernameless: no `allowCredentials` means the platform authenticator
 * shows an account picker for whichever passkeys are already enrolled on
 * this device for this origin, so the user doesn't type an email either.
 */
export async function POST(request: Request) {
  try {
    const identifier = getClientIdentifier(request);
    // Tighter budget than the general "write" bucket — this is an
    // unauthenticated, auth-adjacent endpoint.
    const rate = await checkRateLimit("auth-sensitive", identifier);
    if (!rate.success) {
      return rateLimitResponse(rate);
    }

    const { rpID } = await getRpConfig();

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
    });

    await authenticationChallenge.set(options.challenge);

    return NextResponse.json({ options });
  } catch (error) {
    console.error("webauthn authenticate-options failed", error);
    return NextResponse.json({ error: "Unable to start passkey sign-in" }, { status: 500 });
  }
}
