/**
 * Depreciation calculation utility for assets
 * Supports straight-line depreciation based on asset category rates
 */

export interface DepreciationResult {
  originalValue: number;
  depreciationRate: number; // annual percentage
  yearsSinceAcquisition: number;
  accumulatedDepreciation: number;
  currentValue: number;
  salvageValue: number;
  annualDepreciationAmount: number;
}

/**
 * Calculate depreciation for an asset using straight-line method
 * Formula: Current Value = Original Price × (1 - (Depreciation Rate × Years) / 100)
 */
export function calculateAssetDepreciation(
  purchasePrice: number,
  depreciationRatePercentage: number,
  purchaseDate: string | Date,
  salvagePercentage: number = 10
): DepreciationResult {
  const purchaseDateObj = typeof purchaseDate === "string" ? new Date(purchaseDate) : purchaseDate;
  const today = new Date();

  // Calculate years since acquisition
  const yearsSinceAcquisition = (today.getTime() - purchaseDateObj.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  // Ensure non-negative years
  const actualYears = Math.max(0, yearsSinceAcquisition);

  // Calculate salvage value (typically 10% of original)
  const salvageValue = purchasePrice * (salvagePercentage / 100);

  // Depreciation is capped at salvage value
  const maxDepreciableAmount = purchasePrice - salvageValue;
  const annualDepreciationAmount = (maxDepreciableAmount * depreciationRatePercentage) / 100;

  // Total accumulated depreciation
  const accumulatedDepreciation = Math.min(
    annualDepreciationAmount * actualYears,
    maxDepreciableAmount
  );

  // Current value
  const currentValue = purchasePrice - accumulatedDepreciation;

  return {
    originalValue: purchasePrice,
    depreciationRate: depreciationRatePercentage,
    yearsSinceAcquisition: actualYears,
    accumulatedDepreciation,
    currentValue: Math.max(currentValue, salvageValue),
    salvageValue,
    annualDepreciationAmount,
  };
}

/**
 * Calculate total portfolio value with depreciation
 */
export function calculatePortfolioValue(
  assets: Array<{
    purchasePrice: number;
    depreciationRate: number;
    purchaseDate: string | Date;
  }>
): {
  totalOriginalValue: number;
  totalCurrentValue: number;
  totalAccumulatedDepreciation: number;
} {
  let totalOriginalValue = 0;
  let totalCurrentValue = 0;
  let totalAccumulatedDepreciation = 0;

  for (const asset of assets) {
    const depreciation = calculateAssetDepreciation(
      asset.purchasePrice,
      asset.depreciationRate,
      asset.purchaseDate
    );

    totalOriginalValue += depreciation.originalValue;
    totalCurrentValue += depreciation.currentValue;
    totalAccumulatedDepreciation += depreciation.accumulatedDepreciation;
  }

  return {
    totalOriginalValue,
    totalCurrentValue,
    totalAccumulatedDepreciation,
  };
}
