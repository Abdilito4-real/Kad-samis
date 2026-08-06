export interface ReportExportData {
  summary?: {
    assets?: number;
    maintenance?: number;
    transfers?: number;
    pendingMaintenance?: number;
  };
  maintenance?: Array<Record<string, unknown>>;
  transfers?: Array<Record<string, unknown>>;
  assets?: Array<Record<string, unknown>>;
}

function toCsvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function toCsvRows(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  return [headers, ...rows.map((row) => headers.map((header) => toCsvValue(row[header])))] as string[][];
}

export function buildReportCsv(report: ReportExportData) {
  if (report.assets?.length) {
    const assetRows = toCsvRows(report.assets);
    return assetRows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
  }

  if (report.maintenance?.length) {
    const maintenanceRows = toCsvRows(report.maintenance);
    return maintenanceRows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
  }

  if (report.transfers?.length) {
    const transferRows = toCsvRows(report.transfers);
    return transferRows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
  }

  const rows = [
    ["metric", "value"],
    ["assets", String(report.summary?.assets ?? 0)],
    ["maintenance", String(report.summary?.maintenance ?? 0)],
    ["transfers", String(report.summary?.transfers ?? 0)],
    ["pending maintenance", String(report.summary?.pendingMaintenance ?? 0)],
  ];

  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export function getDefaultSettings() {
  return {
    defaultView: "dashboard",
    emailAlerts: true,
    autoRefresh: true,
    compactMode: false,
  };
}
