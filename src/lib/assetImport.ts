import { toCSV } from "@/lib/csv";

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

/** Builds the downloadable CSV template: header row + one worked example. */
export function buildAssetTemplateCSV(categories: AssetCategoryOption[]): string {
  const exampleCategory = categories[0]?.name ?? "Vehicles";
  const rows: Array<Array<string | number>> = [
    [...ASSET_CSV_HEADERS],
    [1, "Toyota Hilux Pickup", "Toyota", CURRENT_YEAR, 15000000, "good", "KD-2026-001", 3, "active", exampleCategory],
  ];
  return toCSV(rows);
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
    errors,
  };
}
