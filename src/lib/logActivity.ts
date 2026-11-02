import { createClient } from "@/lib/supabase/client";

type ExportType = "assets" | "organizations";

export async function logExportActivity(exportType: ExportType, count: number) {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = supabase ? await supabase.auth.getSession() : { data: { session: null } };

    if (!session?.access_token) {
      console.warn("Export activity email skipped because no signed-in session was available");
      return;
    }

    const response = await fetch("/api/activity/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ exportType, count }),
      keepalive: true,
    });

    if (!response.ok) {
      console.error("Export activity logging failed", response.status);
    }
  } catch (error) {
    console.error("Export activity logging failed", error);
  }
}
