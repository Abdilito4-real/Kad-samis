import { NextResponse } from "next/server";
import { createServerSideClient } from "@/lib/supabase/server";
import { toCSV } from "@/lib/csv";
import {
  getProfile,
  getServiceRoleClient,
  writeAudit,
} from "@/lib/supabase/serverHelpers";

const ADMIN_ROLES = new Set([
  "super_admin",
  "agency_admin",
  "ministry_admin",
  "department_head",
]);
const PAGE_SIZE = 1000;
const MAX_BACKUP_ROWS = 100_000;

type BackupRow = Record<string, unknown>;
type TableQuery = (query: any) => any;

async function fetchRows(
  client: any,
  table: string,
  applyFilter: TableQuery | undefined,
  totalRows: { value: number }
): Promise<BackupRow[]> {
  const rows: BackupRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = client.from(table).select("*").order("id", { ascending: true });
    if (applyFilter) query = applyFilter(query);

    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Unable to export ${table}: ${error.message}`);
    }

    const page = (data ?? []) as BackupRow[];
    totalRows.value += page.length;
    if (totalRows.value > MAX_BACKUP_ROWS) {
      throw new Error(
        `Backup exceeds the ${MAX_BACKUP_ROWS.toLocaleString()}-record export limit.`
      );
    }

    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchRowsByIds(
  client: any,
  table: string,
  column: string,
  ids: string[],
  totalRows: { value: number }
) {
  const rows: BackupRow[] = [];
  for (let index = 0; index < ids.length; index += 500) {
    const batch = ids.slice(index, index + 500);
    rows.push(
      ...(await fetchRows(
        client,
        table,
        (query) => query.in(column, batch),
        totalRows
      ))
    );
  }
  return rows;
}

function csvCell(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return JSON.stringify(value);
  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return value;
  }
  return String(value);
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSideClient();
    const context = await getProfile(supabase, request);
    if (!context?.profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = context.profile.role as string;
    if (!ADMIN_ROLES.has(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isSuperAdmin = role === "super_admin";
    const organizationId = context.profile.organization_id as string | null;
    if (!isSuperAdmin && !organizationId) {
      return NextResponse.json(
        { error: "Your administrator profile has no organization assigned." },
        { status: 403 }
      );
    }

    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!serviceKey || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { error: "Server backup access is not configured." },
        { status: 503 }
      );
    }

    const client = getServiceRoleClient(supabase);
    const totalRows = { value: 0 };
    const organizationFilter = (query: any) =>
      isSuperAdmin ? query : query.eq("id", organizationId);
    const assetFilter = (query: any) =>
      isSuperAdmin
        ? query
        : query.eq("organization_id", organizationId);
    const requestFilter = (query: any) =>
      isSuperAdmin
        ? query
        : query.eq("organization_id", organizationId);

    const organizations = await fetchRows(
      client,
      "organizations",
      isSuperAdmin ? undefined : organizationFilter,
      totalRows
    );
    const categories = await fetchRows(
      client,
      "asset_categories",
      undefined,
      totalRows
    );
    const subcategories = await fetchRows(
      client,
      "asset_subcategories",
      undefined,
      totalRows
    );
    const assets = await fetchRows(client, "assets", assetFilter, totalRows);
    const requests = await fetchRows(
      client,
      "requests",
      requestFilter,
      totalRows
    );

    const assetIds = assets
      .map((asset) => asset.id)
      .filter((id): id is string => typeof id === "string");
    const maintenanceRequests = await fetchRowsByIds(
      client,
      "maintenance_requests",
      "asset_id",
      assetIds,
      totalRows
    );
    const inspections = await fetchRowsByIds(
      client,
      "inspections",
      "asset_id",
      assetIds,
      totalRows
    );
    const transfers = await fetchRowsByIds(
      client,
      "asset_transfers",
      "asset_id",
      assetIds,
      totalRows
    );
    const maintenanceIds = maintenanceRequests
      .map((row) => row.id)
      .filter((id): id is string => typeof id === "string");
    const maintenanceLogs = await fetchRowsByIds(
      client,
      "maintenance_logs",
      "maintenance_request_id",
      maintenanceIds,
      totalRows
    );

    const tables: Array<[string, BackupRow[]]> = [
      ["organizations", organizations],
      ["asset_categories", categories],
      ["asset_subcategories", subcategories],
      ["assets", assets],
      ["requests", requests],
      ["maintenance_requests", maintenanceRequests],
      ["maintenance_logs", maintenanceLogs],
      ["inspections", inspections],
      ["asset_transfers", transfers],
    ];
    const fields = Array.from(
      new Set(tables.flatMap(([, rows]) => rows.flatMap((row) => Object.keys(row))))
    );
    const csvRows: Array<Array<string | number | null>> = [
      ["record_type", ...fields],
      ...tables.flatMap(([table, rows]) =>
        rows.map((row) => [
          table,
          ...fields.map((field) => csvCell(row[field])),
        ])
      ),
    ];
    const csv = `\uFEFF${toCSV(csvRows)}`;

    const tableCounts = Object.fromEntries(
      tables.map(([table, rows]) => [table, rows.length])
    );
    const auditRecorded = await writeAudit(client, request, {
      action: "export",
      table_name: "operational_backup",
      new_values: {
        row_count: totalRows.value,
        table_counts: tableCounts,
        scope: isSuperAdmin ? "all_organizations" : organizationId,
        format: "csv",
      },
      user_id: context.user.id,
    });
    if (!auditRecorded) {
      return NextResponse.json(
        { error: "Unable to record the backup export in the audit log." },
        { status: 500 }
      );
    }

    const date = new Date().toISOString().slice(0, 10);
    const filename = `kad-samis-operational-backup-${date}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Operational backup export failed", error);
    const message =
      error instanceof Error ? error.message : "Unable to generate backup export.";
    const status = message.includes("export limit") ? 413 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
