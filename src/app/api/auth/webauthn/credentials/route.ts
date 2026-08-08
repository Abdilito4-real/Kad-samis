import { NextResponse } from "next/server";
import { createServerSideClient } from "@/lib/supabase/server";
import { getSupabaseFromRequest } from "@/lib/supabase/serverHelpers";

/** List and remove the signed-in user's own passkeys (Settings page). */
export async function GET(request: Request) {
  try {
    const supabase = getSupabaseFromRequest(request) ?? (await createServerSideClient());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("webauthn_credentials")
      .select("id, device_name, created_at, last_used_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ credentials: data ?? [] });
  } catch (error) {
    console.error("webauthn credentials list failed", error);
    return NextResponse.json({ error: "Unable to load passkeys" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = getSupabaseFromRequest(request) ?? (await createServerSideClient());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing passkey id" }, { status: 400 });
    }

    // RLS (webauthn_credentials_delete_own) already scopes this to the
    // caller's own rows — the .eq('user_id', ...) is defense in depth, not
    // load-bearing.
    const { error } = await supabase.from("webauthn_credentials").delete().eq("id", id).eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("webauthn credential delete failed", error);
    return NextResponse.json({ error: "Unable to remove passkey" }, { status: 500 });
  }
}
