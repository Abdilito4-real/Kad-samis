import { NextResponse } from "next/server";
import { createServerSideClient } from "@/lib/supabase/server";
import { getSupabaseFromRequest } from "@/lib/supabase/serverHelpers";

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseFromRequest(request) ?? await createServerSideClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, message, related_request_id, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notifications: data ?? [] });
  } catch (error) {
    console.error("Notifications fetch failed", error);
    return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseFromRequest(request) ?? await createServerSideClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const query = supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id);

    if (body.id) {
      query.eq("id", body.id);
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notifications update failed", error);
    return NextResponse.json({ error: "Unable to update notifications" }, { status: 500 });
  }
}
