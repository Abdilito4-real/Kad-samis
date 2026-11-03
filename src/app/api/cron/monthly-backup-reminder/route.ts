import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/sendbyte";

const ADMIN_ROLES = [
  "super_admin",
  "agency_admin",
  "ministry_admin",
  "department_head",
];
const LAGOS_TIME_ZONE = "Africa/Lagos";

function lagosDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function isLastDayOfMonth(date: Date) {
  const parts = lagosDateParts(date);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { isLastDay: day === lastDay, monthKey: `${parts.year}-${parts.month}` };
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service-role access is not configured.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function updateReminderStatus(
  client: ReturnType<typeof getServiceClient>,
  monthKey: string,
  values: Record<string, unknown>
) {
  const { error } = await client
    .from("monthly_backup_reminders")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("month_key", monthKey);
  if (error) throw new Error(`Unable to update reminder status: ${error.message}`);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("Monthly backup reminder failed: CRON_SECRET is not configured");
    return NextResponse.json({ error: "Scheduled job is not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { isLastDay, monthKey } = isLastDayOfMonth(new Date());
  if (!isLastDay) {
    return NextResponse.json({ skipped: true, reason: "Not the last day in Africa/Lagos." });
  }

  let client: ReturnType<typeof getServiceClient> | undefined;
  let claimed = false;
  try {
    client = getServiceClient();
    const { error: claimError } = await client
      .from("monthly_backup_reminders")
      .insert({ month_key: monthKey, status: "processing" });

    if (claimError?.code === "23505") {
      const { data: existing, error: lookupError } = await client
        .from("monthly_backup_reminders")
        .select("status")
        .eq("month_key", monthKey)
        .maybeSingle();
      if (lookupError) throw new Error(`Unable to check reminder status: ${lookupError.message}`);

      if (existing?.status === "sent" || existing?.status === "processing") {
        return NextResponse.json({ sent: existing.status === "sent", alreadyProcessed: true });
      }

      const { data: retry, error: retryError } = await client
        .from("monthly_backup_reminders")
        .update({ status: "processing", error_message: null, updated_at: new Date().toISOString() })
        .eq("month_key", monthKey)
        .eq("status", "failed")
        .select("month_key")
        .maybeSingle();
      if (retryError) throw new Error(`Unable to retry reminder: ${retryError.message}`);
      if (!retry) {
        return NextResponse.json({ alreadyProcessed: true });
      }
    } else if (claimError) {
      throw new Error(`Unable to claim monthly reminder: ${claimError.message}`);
    }
    claimed = true;

    const { data: admins, error: adminError } = await client
      .from("profiles")
      .select("id, email")
      .in("role", ADMIN_ROLES);
    if (adminError) throw new Error(`Unable to load administrators: ${adminError.message}`);
    if (!admins?.length) throw new Error("No administrators were found for the monthly reminder.");

    const monthLabel = new Intl.DateTimeFormat("en-NG", {
      timeZone: LAGOS_TIME_ZONE,
      month: "long",
      year: "numeric",
    }).format(new Date());
    const title = `Monthly backup reminder — ${monthLabel}`;
    const message =
      "Download your operational CSV backup from Admin > Backups, save it in your approved secure location, and verify that it opens and contains the expected records. This is not a full Supabase backup and does not include user accounts or stored files.";
    const dedupeKey = `monthly-backup:${monthKey}`;
    const notificationRows = admins.map((admin) => ({
      user_id: admin.id,
      type: "backup_reminder",
      title,
      message,
      dedupe_key: dedupeKey,
    }));

    const { error: notificationError } = await client
      .from("notifications")
      .upsert(notificationRows, {
        onConflict: "user_id,dedupe_key",
        ignoreDuplicates: true,
      });
    if (notificationError) {
      throw new Error(`Unable to create in-app reminders: ${notificationError.message}`);
    }

    const emailRecipients = Array.from(
      new Set(
        admins
          .map((admin) => admin.email?.trim())
          .filter((email): email is string => Boolean(email))
      )
    );
    if (!emailRecipients.length) {
      throw new Error("No administrator email addresses are available.");
    }

    const emailSent = await sendEmail({
      to: emailRecipients,
      subject: `KAD-SAMIS: ${title}`,
      text: `${message}\n\nSign in to KAD-SAMIS and open Admin > Backups to download the CSV.`,
    });
    if (!emailSent) throw new Error("Monthly backup email could not be delivered; check SendByte configuration.");

    await updateReminderStatus(client, monthKey, {
      status: "sent",
      notification_count: admins.length,
      email_sent_at: new Date().toISOString(),
      error_message: null,
    });

    return NextResponse.json({
      sent: true,
      notificationCount: admins.length,
      emailRecipientCount: emailRecipients.length,
    });
  } catch (error) {
    console.error("Monthly backup reminder failed", error);
    if (client && claimed) {
      try {
        await updateReminderStatus(client, monthKey, {
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown delivery error",
        });
      } catch (statusError) {
        console.error("Unable to record monthly backup reminder failure", statusError);
      }
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send monthly reminder." },
      { status: 500 }
    );
  }
}
