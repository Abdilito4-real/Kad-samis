"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AssetEdit } from "@/components/assets/AssetEdit";
import { Button } from "@/components/ui/button";

interface Asset {
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
}

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data: { session } } = supabase
          ? await supabase.auth.getSession()
          : { data: { session: null } };

        if (!session?.access_token) {
          throw new Error("Please sign in to view this asset");
        }

        const response = await fetch(`/api/admin/assets/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body?.error || "Unable to load asset");
        }

        if (!cancelled) {
          setAsset(body.asset);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Unable to load asset");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading asset...
        </div>
      ) : error || !asset ? (
        <div className="space-y-4">
          <Button variant="outline" size="sm" asChild className="w-fit gap-2">
            <Link href="/assets">
              <ArrowLeft className="h-4 w-4" />
              Back to assets
            </Link>
          </Button>
          <div className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-500">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Unable to load asset</p>
              <p className="mt-1 text-rose-500/80">{error || "This asset could not be found."}</p>
            </div>
          </div>
        </div>
      ) : (
        <AssetEdit asset={asset} />
      )}
    </div>
  );
}
