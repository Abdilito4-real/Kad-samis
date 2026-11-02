export type WarrantyStatus = "active" | "expires-this-year" | "expired";

export interface WarrantyAssessment {
  status: WarrantyStatus;
  expiryYear: number;
  label: string;
}

export function assessWarranty(
  purchaseYear: number | null | undefined,
  warrantyYears: number | null | undefined,
  currentYear = new Date().getFullYear()
): WarrantyAssessment | null {
  if (typeof warrantyYears !== "number" || !Number.isInteger(warrantyYears) || warrantyYears < 0) {
    return null;
  }

  if (warrantyYears === 0) {
    return {
      status: "expired",
      expiryYear: typeof purchaseYear === "number" && Number.isInteger(purchaseYear) ? purchaseYear : currentYear,
      label: "No warranty coverage",
    };
  }

  if (typeof purchaseYear !== "number" || !Number.isInteger(purchaseYear)) {
    return null;
  }

  const expiryYear = purchaseYear + warrantyYears;
  if (currentYear > expiryYear) {
    return { status: "expired", expiryYear, label: `Warranty expired after ${expiryYear}` };
  }
  if (currentYear === expiryYear) {
    return { status: "expires-this-year", expiryYear, label: `Warranty may expire this year (${expiryYear})` };
  }

  return { status: "active", expiryYear, label: `Warranty active (estimated through ${expiryYear})` };
}
