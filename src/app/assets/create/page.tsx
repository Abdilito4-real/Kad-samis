"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { parseCSVWithHeader, downloadCSV } from "@/lib/csv";
import {
  ASSET_CONDITIONS,
  ASSET_STATUSES,
  buildAssetTemplateCSV,
  validateAssetRow,
  type AssetCategoryOption,
  type ParsedAssetRow,
} from "@/lib/assetImport";

type ImportResult = {
  created: Array<{ asset_number: string; name: string }>;
  skipped: Array<{ rowNumber: number; assetNumber: string; reasons: string[] }>;
};

export default function ImportAssetsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<AssetCategoryOption[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedAssetRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const validRows = useMemo(() => parsedRows.filter((r) => r.errors.length === 0), [parsedRows]);
  const invalidRows = useMemo(() => parsedRows.filter((r) => r.errors.length > 0), [parsedRows]);

  const ensureCategories = async (): Promise<AssetCategoryOption[]> => {
    if (categoriesLoaded) return categories;
    try {
      const response = await fetch("/api/admin/asset-categories");
      const json = await response.json();
      const loaded: AssetCategoryOption[] = json.categories ?? [];
      setCategories(loaded);
      setCategoriesLoaded(true);
      return loaded;
    } catch {
      toast.error("Unable to load asset categories.");
      return [];
    }
  };

  const handleDownloadTemplate = async () => {
    const cats = await ensureCategories();
    if (cats.length === 0) {
      toast.error("No asset categories are configured yet. Ask a super admin to add one first.");
      return;
    }
    downloadCSV("assets-import-template.csv", buildAssetTemplateCSV(cats));
    toast.success("Template downloaded");
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file after a fix
    if (!file) return;

    const cats = await ensureCategories();
    if (cats.length === 0) {
      toast.error("No asset categories are configured yet. Ask a super admin to add one first.");
      return;
    }

    setResult(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      const records = parseCSVWithHeader(text);
      if (records.length === 0) {
        toast.error("That file has no data rows.");
        setParsedRows([]);
        return;
      }

      const rows = records.map((record, index) => validateAssetRow(record, index + 1, cats));
      setParsedRows(rows);

      const invalidCount = rows.filter((r) => r.errors.length > 0).length;
      if (invalidCount > 0) {
        toast.warning(`${invalidCount} of ${rows.length} rows need fixing before import.`);
      } else {
        toast.success(`${rows.length} rows look good — ready to import.`);
      }
    } catch (error) {
      console.error("CSV parse failed", error);
      toast.error("Unable to read that file. Make sure it's a CSV exported from the template.");
    }
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const supabase = createClient();
      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      if (!session?.access_token) {
        throw new Error("Please sign in again to import assets");
      }

      const response = await fetch("/api/admin/assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          rows: validRows.map((r) => ({
            rowNumber: r.rowNumber,
            assetNumber: r.assetNumber,
            name: r.name,
            make: r.make,
            purchaseYear: r.purchaseYear,
            purchaseValue: r.purchaseValue,
            condition: r.condition,
            warrantyYears: r.warrantyYears,
            status: r.status,
            categoryId: r.categoryId,
          })),
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || "Unable to import assets");
      }

      setResult(json);
      setParsedRows([]);

      if (json.created?.length) {
        toast.success(`Imported ${json.created.length} asset${json.created.length === 1 ? "" : "s"}.`);
      }
      if (json.skipped?.length) {
        toast.warning(`${json.skipped.length} row${json.skipped.length === 1 ? "" : "s"} could not be imported.`);
      }
    } catch (error: any) {
      toast.error(error?.message || "Unable to import assets");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" size="sm" asChild className="w-fit gap-2 -ml-2">
        <Link href="/assets">
          <ArrowLeft className="h-4 w-4" />
          Back to assets
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Import assets from CSV</CardTitle>
          <p className="text-sm text-muted-foreground">
            Download the template, fill in one row per asset, then upload it here. Assets are added to the register
            in bulk — no more filling out a form one asset at a time.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="outline" onClick={handleDownloadTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              Download CSV template
            </Button>
            <Button type="button" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload filled-in CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="grid gap-4 rounded-2xl border border-border bg-muted/30 p-4 text-sm sm:grid-cols-3">
            <div>
              <p className="font-medium text-foreground">Condition must be one of</p>
              <p className="mt-1 text-muted-foreground capitalize">{ASSET_CONDITIONS.join(", ")}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Status must be one of</p>
              <p className="mt-1 text-muted-foreground capitalize">{ASSET_STATUSES.join(", ")}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Category must match exactly</p>
              <p className="mt-1 text-muted-foreground">
                {categoriesLoaded
                  ? categories.map((c) => c.name).join(", ") || "No categories configured yet"
                  : "Loaded when you download the template or upload a file"}
              </p>
            </div>
          </div>

          {fileName && parsedRows.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{fileName}</span>
                <Badge className="bg-emerald-500/10 text-emerald-600">{validRows.length} ready</Badge>
                {invalidRows.length > 0 && (
                  <Badge className="bg-rose-500/10 text-rose-500">{invalidRows.length} need fixing</Badge>
                )}
              </div>

              {invalidRows.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-rose-500/20">
                  <div className="bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-600">
                    Fix these rows in your CSV and re-upload
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-border">
                    {invalidRows.map((row) => (
                      <div key={row.rowNumber} className="px-4 py-3 text-sm">
                        <p className="font-medium">
                          Row {row.rowNumber}
                          {row.name ? ` — ${row.name}` : ""}
                        </p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-rose-500">
                          {row.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleImport}
                  disabled={validRows.length === 0}
                  isLoading={importing}
                  loadingText="Importing..."
                  className="gap-2 rounded-3xl px-6 py-3"
                >
                  Import {validRows.length} asset{validRows.length === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3 rounded-2xl border border-border p-4">
              {result.created.length > 0 && (
                <div className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  <div>
                    <p className="font-medium">{result.created.length} asset{result.created.length === 1 ? "" : "s"} imported</p>
                    <p className="text-muted-foreground">{result.created.map((a) => a.asset_number).join(", ")}</p>
                  </div>
                </div>
              )}
              {result.skipped.length > 0 && (
                <div className="flex items-start gap-3 text-sm">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                  <div className="space-y-1">
                    <p className="font-medium">{result.skipped.length} row{result.skipped.length === 1 ? "" : "s"} skipped</p>
                    <ul className="space-y-1 text-muted-foreground">
                      {result.skipped.map((row) => (
                        <li key={row.rowNumber}>
                          Row {row.rowNumber} ({row.assetNumber || "no ID"}): {row.reasons.join("; ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => router.push("/assets")}>
                  Go to asset register
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
