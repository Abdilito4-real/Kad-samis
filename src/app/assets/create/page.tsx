"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Activity, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Tags, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { parseCSVWithHeader, downloadBlob } from "@/lib/csv";
import {
  ASSET_CONDITIONS,
  ASSET_STATUSES,
  buildAssetTemplateWorkbook,
  parseAssetWorkbook,
  validateAssetRow,
  type AssetCategoryOption,
  type ParsedAssetRow,
} from "@/lib/assetImport";

const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const isExcelFile = (file: File) => /\.xlsx$/i.test(file.name) || file.type === EXCEL_MIME;

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
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
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
    setDownloadingTemplate(true);
    try {
      const cats = await ensureCategories();
      if (cats.length === 0) {
        toast.error("No asset categories are configured yet. Ask a super admin to add one first.");
        return;
      }
      const workbook = await buildAssetTemplateWorkbook();
      downloadBlob("assets-import-template.xlsx", workbook);
      toast.success("Template downloaded");
    } finally {
      setDownloadingTemplate(false);
    }
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
      const records = isExcelFile(file) ? await parseAssetWorkbook(file) : parseCSVWithHeader(await file.text());
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
      console.error("Import file parse failed", error);
      toast.error("Unable to read that file. Make sure it's the CSV or Excel file from the downloaded template.");
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
            geolocation: r.geolocation,
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
          <CardTitle>Import assets in bulk</CardTitle>
          <p className="text-sm text-muted-foreground">
            Download the Excel template, fill in one row per asset, then upload it here (CSV also accepted). Assets
            are added to the register in bulk — no more filling out a form one asset at a time.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadTemplate}
              isLoading={downloadingTemplate}
              loadingText="Preparing…"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download Excel template
            </Button>
            <Button type="button" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload filled-in file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="grid overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-border">
            <div className="min-w-0 p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                Condition
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Choose one condition</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ASSET_CONDITIONS.map((condition) => {
                  const tone = {
                    excellent: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
                    good: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300",
                    fair: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300",
                    poor: "bg-orange-500/10 text-orange-700 ring-orange-500/20 dark:text-orange-300",
                    damaged: "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300",
                  }[condition] ?? "bg-muted text-muted-foreground ring-border";

                  return (
                    <span key={condition} className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${tone}`}>
                      {condition}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="min-w-0 border-t border-border p-4 sm:border-t-0 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Activity className="h-4 w-4 shrink-0 text-sky-600" />
                Status
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Choose one status</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ASSET_STATUSES.map((status) => {
                  const tone = {
                    active: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
                    inactive: "bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:text-slate-300",
                    maintenance: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300",
                    disposal: "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300",
                    archived: "bg-zinc-500/10 text-zinc-700 ring-zinc-500/20 dark:text-zinc-300",
                  }[status] ?? "bg-muted text-muted-foreground ring-border";

                  return (
                    <span key={status} className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${tone}`}>
                      {status}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="min-w-0 border-t border-border p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Tags className="h-4 w-4 shrink-0 text-violet-600" />
                Category
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Names must match exactly</p>
              {categoriesLoaded ? (
                categories.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <span key={category.id} className="max-w-full break-words rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground">
                        {category.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No categories configured yet.</p>
                )
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Category names load with the template or uploaded file.</p>
              )}
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
                    Fix these rows in your file and re-upload
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
