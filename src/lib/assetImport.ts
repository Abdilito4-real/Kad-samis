import type ExcelJSType from "exceljs";

/** Column headers exactly as they appear in the downloadable template. */
export const ASSET_CSV_HEADERS = [
  "SN",
  "Assets Name",
  "Make",
  "Year",
  "Purchase Value",
  "Condition",
  "Assets ID or Number",
  "Warranty Years",
  "Status",
  "Category",
  "Geolocation",
] as const;

export const ASSET_CONDITIONS = ["excellent", "good", "fair", "poor", "damaged"] as const;
export const ASSET_STATUSES = ["active", "inactive", "maintenance", "disposal", "archived"] as const;

export type AssetCondition = (typeof ASSET_CONDITIONS)[number];
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export interface AssetCategoryOption {
  id: string;
  name: string;
}

/** A CSV row parsed and coerced into the shape the API expects, or null fields where invalid. */
export interface ParsedAssetRow {
  rowNumber: number; // 1-based, matches the CSV data row (header excluded)
  assetNumber: string;
  name: string;
  make: string | null;
  purchaseYear: number | null;
  purchaseValue: number | null;
  condition: AssetCondition | null;
  warrantyYears: number | null;
  status: AssetStatus;
  categoryId: string | null;
  categoryName: string;
  latitude: number | null;
  longitude: number | null;
  errors: string[];
}

const CURRENT_YEAR = new Date().getFullYear();

function findCell(record: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const key = Object.keys(record).find((k) => k.trim().toLowerCase() === name.toLowerCase());
    if (key) return (record[key] ?? "").trim();
  }
  return "";
}

export interface ParsedGeolocation {
  latitude: number | null;
  longitude: number | null;
  error?: string;
}

/**
 * Parses a single "latitude, longitude" cell/field into numeric
 * coordinates — the CSV/Excel template's one-column shape for what the
 * database stores as a split latitude/longitude pair, same as
 * buildings/facilities/inspections already do. Shared between CSV row
 * validation (below) and the single-asset edit form's PATCH handler so
 * both paths enforce the exact same format. Empty input is valid
 * (geolocation is optional) and returns nulls with no error.
 */
export function parseGeolocation(raw: string): ParsedGeolocation {
  const trimmed = raw.trim();
  if (!trimmed) return { latitude: null, longitude: null };

  const parts = trimmed.split(",").map((p) => p.trim());
  if (parts.length !== 2) {
    return { latitude: null, longitude: null, error: `Geolocation "${raw}" must be "latitude, longitude"` };
  }

  const [latRaw, lngRaw] = parts;
  const latitude = Number(latRaw);
  const longitude = Number(lngRaw);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { latitude: null, longitude: null, error: `Geolocation latitude "${latRaw}" must be a number between -90 and 90` };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { latitude: null, longitude: null, error: `Geolocation longitude "${lngRaw}" must be a number between -180 and 180` };
  }

  return { latitude, longitude };
}

/** Formats stored latitude/longitude back into the same "latitude,
 * longitude" shape used for input and CSV/Excel export — the inverse of
 * parseGeolocation. Either coordinate missing renders as "" rather than a
 * partial/misleading value. */
export function formatGeolocation(latitude: number | null | undefined, longitude: number | null | undefined): string {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return "";
  return `${latitude}, ${longitude}`;
}

/**
 * Builds the downloadable import template as a real .xlsx workbook —
 * headers only, no sample/worked-example row, with the header row bold and
 * shaded. Plain CSV has no styling capability at all (it's just delimited
 * text), so "bold headers" requires an actual spreadsheet format; exceljs
 * is loaded dynamically so pages that only need CSV export (assets export
 * on /assets) never pay for pulling it into their bundle.
 */
export async function buildAssetTemplateWorkbook(): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Assets");

  // Assigning `columns` with a `header` per entry both writes row 1 and
  // sets sensible column widths — no separate addRow() call, so there's no
  // second row of sample data left behind.
  sheet.columns = ASSET_CSV_HEADERS.map((header) => ({
    header,
    key: header,
    width: Math.max(16, header.length + 4),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FF0F172A" } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF94A3B8" } } };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Reads an uploaded .xlsx (e.g. the filled-in template) into the same
 * header-keyed row shape `parseCSVWithHeader` produces, so both formats
 * feed the same `validateAssetRow` pipeline downstream. */
export async function parseAssetWorkbook(file: File): Promise<Record<string, string>[]> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const cellToString = (value: ExcelJSType.CellValue): string => {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object") {
      if ("richText" in value) return (value.richText as Array<{ text: string }>).map((t) => t.text).join("");
      if ("text" in value) return String((value as { text: unknown }).text ?? "");
      if ("result" in value) return String((value as { result: unknown }).result ?? "");
    }
    return String(value).trim();
  };

  let headers: string[] = [];
  const records: Record<string, string>[] = [];

  sheet.eachRow((row, rowNumber) => {
    const values = (row.values as ExcelJSType.CellValue[]).slice(1).map(cellToString);
    if (rowNumber === 1) {
      headers = values.map((h) => h.trim());
      return;
    }
    if (values.every((v) => v.trim().length === 0)) return; // skip blank rows
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] ?? "").trim();
    });
    records.push(record);
  });

  return records;
}

/**
 * Validates and coerces one parsed CSV record. Category is resolved
 * client-side against the fetched category list so the API can receive a
 * clean category_id, same as the old single-asset form did.
 */
export function validateAssetRow(
  record: Record<string, string>,
  rowNumber: number,
  categories: AssetCategoryOption[]
): ParsedAssetRow {
  const errors: string[] = [];

  const name = findCell(record, "Assets Name", "Asset Name", "Name");
  const assetNumber = findCell(record, "Assets ID or Number", "Assets ID or number", "Asset Number", "Asset ID");
  const make = findCell(record, "Make") || null;
  const yearRaw = findCell(record, "Year");
  const valueRaw = findCell(record, "Purchase Value");
  const conditionRaw = findCell(record, "Condition");
  const warrantyRaw = findCell(record, "Warranty Years");
  const statusRaw = findCell(record, "Status");
  const categoryRaw = findCell(record, "Category");
  const geolocationRaw = findCell(record, "Geolocation");

  if (!name) errors.push("Assets Name is required");
  if (!assetNumber) errors.push("Assets ID or Number is required");

  let purchaseYear: number | null = null;
  if (yearRaw) {
    const parsed = Number(yearRaw);
    if (!Number.isInteger(parsed) || parsed < 1900 || parsed > CURRENT_YEAR + 1) {
      errors.push(`Year "${yearRaw}" is not a valid year`);
    } else {
      purchaseYear = parsed;
    }
  }

  let purchaseValue: number | null = null;
  if (valueRaw) {
    const parsed = Number(valueRaw.replace(/[₦,\s]/g, ""));
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors.push(`Purchase Value "${valueRaw}" is not a valid amount`);
    } else {
      purchaseValue = parsed;
    }
  }

  let condition: AssetCondition | null = null;
  if (conditionRaw) {
    const normalized = conditionRaw.toLowerCase() as AssetCondition;
    if (!ASSET_CONDITIONS.includes(normalized)) {
      errors.push(`Condition "${conditionRaw}" must be one of: ${ASSET_CONDITIONS.join(", ")}`);
    } else {
      condition = normalized;
    }
  } else {
    errors.push("Condition is required");
  }

  let warrantyYears: number | null = null;
  if (warrantyRaw) {
    const parsed = Number(warrantyRaw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      errors.push(`Warranty Years "${warrantyRaw}" must be a whole number ≥ 0`);
    } else {
      warrantyYears = parsed;
    }
  }

  let status: AssetStatus = "active";
  if (statusRaw) {
    const normalized = statusRaw.toLowerCase() as AssetStatus;
    if (!ASSET_STATUSES.includes(normalized)) {
      errors.push(`Status "${statusRaw}" must be one of: ${ASSET_STATUSES.join(", ")}`);
    } else {
      status = normalized;
    }
  }

  let categoryId: string | null = null;
  if (!categoryRaw) {
    errors.push("Category is required");
  } else {
    const match = categories.find((c) => c.name.toLowerCase() === categoryRaw.toLowerCase());
    if (!match) {
      errors.push(
        `Category "${categoryRaw}" is not recognized. Valid categories: ${categories.map((c) => c.name).join(", ") || "(none configured)"}`
      );
    } else {
      categoryId = match.id;
    }
  }

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (geolocationRaw) {
    const parsedGeo = parseGeolocation(geolocationRaw);
    if (parsedGeo.error) {
      errors.push(parsedGeo.error);
    } else {
      latitude = parsedGeo.latitude;
      longitude = parsedGeo.longitude;
    }
  }

  return {
    rowNumber,
    assetNumber,
    name,
    make,
    purchaseYear,
    purchaseValue,
    condition,
    warrantyYears,
    status,
    categoryId,
    categoryName: categoryRaw,
    latitude,
    longitude,
    errors,
  };
}
