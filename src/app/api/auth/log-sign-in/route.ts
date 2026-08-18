import { NextResponse } from "next/server";
import { createServerSideClient } from "@/lib/supabase/server";
import { getSupabaseFromRequest, writeNotifications } from "@/lib/supabase/serverHelpers";
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from "@/lib/rate-limit";
import { describeUserAgent } from "@/lib/parseUserAgent";

/**
 * Records a "New sign-in" security notification for the caller, right
 * after password or passkey sign-in succeeds — the in-app equivalent of the
 * "New sign-in to your account" alert Google/Facebook send. Best-effort:
 * the login flow fires this and doesn't wait on or surface its result, so a
 * failure here never blocks getting into the app.
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

    const body = await request.json().catch(() => ({}));
    const method: string = body?.method === "passkey" ? "passkey" : "password";
    const device = describeUserAgent(request.headers.get("user-agent"));
    const when = new Date().toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    await writeNotifications(supabase, [
      {
        user_id: user.id,
        type: "security",
        title: "New sign-in",
        message: `Signed in with ${method === "passkey" ? "a passkey" : "your password"} from ${device} · ${identifier} · ${when}. Not you? Change your password in Settings.`,
      },
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("log-sign-in failed", error);
    // Non-critical — the caller ignores this either way.
    return NextResponse.json({ error: "Unable to log sign-in" }, { status: 500 });
  }
}
