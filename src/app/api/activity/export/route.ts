import { NextResponse } from "next/server";
import { createServerSideClient } from "@/lib/supabase/server";
import { getProfile, getSupabaseFromRequest, writeAudit } from "@/lib/supabase/serverHelpers";
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from "@/lib/rate-limit";

const EXPORTS = {
  assets: "assets",
  organizations: "organizations",
} as const;

export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit("write", getClientIdentifier(request));
    if (!rate.success) {
      return rateLimitResponse(rate);
    }

    const supabase = getSupabaseFromRequest(request) ?? (await createServerSideClient());
    const ctx = await getProfile(supabase, request);
    if (!ctx?.profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const tableName = body?.exportType as keyof typeof EXPORTS;
    const count = body?.count;

    if (!(tableName in EXPORTS) || !Number.isSafeInteger(count) || count < 1 || count > 100_000) {
      return NextResponse.json({ error: "Invalid export activity" }, { status: 400 });
    }

    const logged = await writeAudit(supabase, request, {
      action: "export",
      table_name: EXPORTS[tableName],
      new_values: { count },
      user_id: ctx.user.id,
    });

    if (!logged) {
      return NextResponse.json({ error: "Unable to record export activity" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Export activity logging failed", error);
    return NextResponse.json({ error: "Unable to log export activity" }, { status: 500 });
  }
}
