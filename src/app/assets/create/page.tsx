"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AssetForm, type AssetFormValues } from "@/components/assets/AssetForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function CreateAssetPage() {
  const router = useRouter();

  const handleSubmit = async (values: AssetFormValues) => {
    const supabase = createClient();
    const { data: { session } } = await supabase?.auth.getSession() ?? { data: { session: null } };

    const response = await fetch("/api/admin/assets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(values),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error || "Unable to create asset");
    }

    toast.success("Asset created successfully");
    router.push("/assets");
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Create Asset</CardTitle>
          <p className="text-sm text-muted-foreground">Add a new asset to the register and track it in the system.</p>
        </CardHeader>
        <CardContent>
          <AssetForm onSubmit={handleSubmit} submitLabel="Create asset" />
        </CardContent>
      </Card>
    </div>
  );
}
