"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AssetForm, type AssetFormValues } from "@/components/assets/AssetForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestAssetDialog } from "@/components/requests/RequestAssetDialog";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { formatGeolocation } from "@/lib/assetImport";

interface AssetEditProps {
  asset: {
    id: string;
    asset_number: string;
    name: string;
    category_id: string;
    condition: string;
    status: string;
    make: string | null;
    purchase_year: number | null;
    purchase_value: number | null;
    warranty_years: number | null;
    latitude: number | null;
    longitude: number | null;
  };
}

export function AssetEdit({ asset }: AssetEditProps) {
  const router = useRouter();
  const { user } = useAuth();
  const canRequest = Boolean(user?.organizationId);
  const [deleting, setDeleting] = useState(false);
  const initialValues: AssetFormValues = {
    assetNumber: asset.asset_number,
    name: asset.name,
    categoryId: asset.category_id,
    condition: asset.condition,
    status: asset.status,
    make: asset.make || "",
    purchaseYear: asset.purchase_year !== null ? asset.purchase_year.toString() : "",
    purchaseValue: asset.purchase_value !== null ? asset.purchase_value.toString() : "",
    warrantyYears: asset.warranty_years !== null ? asset.warranty_years.toString() : "",
    geolocation: formatGeolocation(asset.latitude, asset.longitude),
  };

  const handleSubmit = async (values: AssetFormValues) => {
    const supabase = createClient();
    const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (!session?.access_token) {
      throw new Error("Please sign in to save changes");
    }

    const response = await fetch(`/api/admin/assets/${asset.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
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

    setDeleting(true);
    try {
      const supabase = createClient();
      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      if (!session?.access_token) {
        toast.error("Please sign in to delete this asset");
        return;
      }

      const response = await fetch(`/api/admin/assets/${asset.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const json = await response.json();
      if (!response.ok) {
        toast.error(json?.error || "Unable to delete asset");
        return;
      }

      toast.success("Asset deleted successfully");
      router.push("/assets");
    } finally {
      setDeleting(false);
    }
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
              <Button
                variant="destructive"
                onClick={handleDelete}
                isLoading={deleting}
                loadingText="Deleting…"
                className="rounded-3xl px-5 py-3"
              >
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
