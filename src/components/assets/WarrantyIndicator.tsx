import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { assessWarranty } from "@/lib/warranty";

interface WarrantyIndicatorProps {
  purchaseYear: number | null | undefined;
  warrantyYears: number | null | undefined;
  compact?: boolean;
}

export function WarrantyIndicator({ purchaseYear, warrantyYears, compact = false }: WarrantyIndicatorProps) {
  const assessment = assessWarranty(purchaseYear, warrantyYears);
  if (!assessment) return null;

  const isExpired = assessment.status === "expired";
  const isExpiring = assessment.status === "expires-this-year";
  const Icon = isExpired || isExpiring ? ShieldAlert : ShieldCheck;
  const label = compact
    ? isExpired
      ? "Out of warranty"
      : isExpiring
        ? `May expire ${assessment.expiryYear}`
        : `Warranty through ~${assessment.expiryYear}`
    : assessment.label;

  return (
    <Badge
      title={assessment.label}
      className={
        isExpired
          ? "gap-1 bg-rose-500/10 text-rose-600"
          : isExpiring
            ? "gap-1 bg-amber-500/10 text-amber-700"
            : "gap-1 bg-emerald-500/10 text-emerald-600"
      }
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}
