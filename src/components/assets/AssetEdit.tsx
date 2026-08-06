"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AssetForm, type AssetFormValues } from "@/components/assets/AssetForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestAssetDialog } from "@/components/requests/RequestAssetDialog";
import { useAuth } from "@/components/auth-provider";

interface AssetEditProps {
  asset: {
    id: string;
    asset_number: string;
    name: string;
    category_id: string;
    condition: string;
    status: string;
    manufacturer: string | null;
    model: string | null;
    serial_number: string | null;
    purchase_date: string | null;
    purchase_price: number | null;
    current_value: number | null;
    warranty_expiry: string | null;
    funding_source: string | null;
    notes: string | null;
  };
}

export function AssetEdit({ asset }: AssetEditProps) {
  const router = useRouter();
  const { user } = useAuth();
  const canRequest = Boolean(user?.organizationId);
  const initialValues: AssetFormValues = {
    assetNumber: asset.asset_number,
    name: asset.name,
    categoryId: asset.category_id,
    condition: asset.condition,
    status: asset.status,
    manufacturer: asset.manufacturer || "",
    model: asset.model || "",
    serialNumber: asset.serial_number || "",
    purchaseDate: asset.purchase_date ? asset.purchase_date.slice(0, 10) : "",
    purchasePrice: asset.purchase_price !== null ? asset.purchase_price.toString() : "",
    currentValue: asset.current_value !== null ? asset.current_value.toString() : "",
    warrantyExpiry: asset.warranty_expiry ? asset.warranty_expiry.slice(0, 10) : "",
    fundingSource: asset.funding_source || "",
    notes: asset.notes || "",
  };

  const handleSubmit = async (values: AssetFormValues) => {
    const response = await fetch(`/api/admin/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error || "Unable to update asset");
    }

    toast.success("Asset updated successfully");
    router.push("/assets");
  };

  const handleDelete = async () => {
    const confirmed = window.confirm("Delete this asset? This action cannot be undone.");
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/admin/assets/${asset.id}`, {
      method: "DELETE",
    });

    const json = await response.json();
    if (!response.ok) {
      toast.error(json?.error || "Unable to delete asset");
      return;
    }

    toast.success("Asset deleted successfully");
    router.push("/assets");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Edit asset</CardTitle>
              <p className="text-sm text-muted-foreground">Update asset details or remove it from the register.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canRequest && (
                <RequestAssetDialog assetId={asset.id} assetName={asset.name} assetNumber={asset.asset_number} />
              )}
              <Button variant="destructive" onClick={handleDelete} className="rounded-3xl px-5 py-3">
                Delete asset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AssetForm initialValues={initialValues} onSubmit={handleSubmit} submitLabel="Save changes" />
        </CardContent>
      </Card>
    </div>
  );
}
