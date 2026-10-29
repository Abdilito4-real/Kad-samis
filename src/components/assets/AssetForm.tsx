"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ASSET_CONDITIONS, ASSET_STATUSES } from "@/lib/assetImport";

export interface AssetCategory {
  id: string;
  name: string;
  code: string;
}

export interface AssetFormValues {
  assetNumber: string;
  name: string;
  categoryId: string;
  condition: string;
  status: string;
  make: string;
  purchaseYear: string;
  purchaseValue: string;
  warrantyYears: string;
  /** Free-text location/address — same field as the CSV template's
   * Geolocation column. Not GPS coordinates. Empty string means "not
   * recorded". */
  geolocation: string;
}

const defaultValues: AssetFormValues = {
  assetNumber: "",
  name: "",
  categoryId: "",
  condition: "good",
  status: "active",
  make: "",
  purchaseYear: "",
  purchaseValue: "",
  warrantyYears: "",
  geolocation: "",
};

interface Props {
  initialValues?: Partial<AssetFormValues>;
  onSubmit: (values: AssetFormValues) => Promise<void>;
  submitLabel: string;
}

// This form is now edit-only — new assets come in through the CSV
// template/import flow on /assets/create. It still covers every field the
// import writes so an asset created via CSV can be corrected here later.
export function AssetForm({ initialValues, onSubmit, submitLabel }: Props) {
  const [values, setValues] = useState<AssetFormValues>({ ...defaultValues, ...(initialValues ?? {}) });
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const initialCategoryId = useRef(values.categoryId);

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      try {
        const response = await fetch("/api/admin/asset-categories");
        const json = await response.json();
        if (response.ok && isMounted) {
          const loadedCategories = json.categories ?? [];
          setCategories(loadedCategories);
          if (!loadedCategories.length) {
            setCategoryError("No asset categories available. Please configure asset categories before creating an asset.");
            setValues((prev) => ({ ...prev, categoryId: "" }));
          } else {
            setCategoryError(null);
            if (!initialCategoryId.current) {
              setValues((prev) => ({ ...prev, categoryId: loadedCategories[0].id }));
            }
          }
        }
      } catch (error) {
        toast.error("Unable to load asset categories.");
        if (isMounted) {
          setCategoryError("Could not load asset categories.");
        }
      } finally {
        if (isMounted) setLoadingCategories(false);
      }
    };

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (key: keyof AssetFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (error: any) {
      toast.error(error?.message || "Unable to save asset.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="assetNumber">Assets ID or number</Label>
          <Input
            id="assetNumber"
            value={values.assetNumber}
            onChange={(event) => handleChange("assetNumber", event.target.value)}
            placeholder="KD-2026-001"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Assets name</Label>
          <Input
            id="name"
            value={values.name}
            onChange={(event) => handleChange("name", event.target.value)}
            placeholder="Generator Set"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <Select
            value={values.categoryId}
            onValueChange={(value) => handleChange("categoryId", value)}
            disabled={loadingCategories || categories.length === 0}
          >
            <SelectTrigger id="categoryId">
              <SelectValue
                placeholder={
                  loadingCategories
                    ? "Loading categories..."
                    : categories.length === 0
                      ? "No categories available"
                      : "Select a category"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {categoryError ? (
            <p className="mt-2 text-sm text-red-500">{categoryError}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="condition">Condition</Label>
          <Select value={values.condition} onValueChange={(value) => handleChange("condition", value)}>
            <SelectTrigger id="condition">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_CONDITIONS.map((condition) => (
                <SelectItem key={condition} value={condition}>
                  {condition.charAt(0).toUpperCase() + condition.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={values.status} onValueChange={(value) => handleChange("status", value)}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="make">Make</Label>
          <Input
            id="make"
            value={values.make}
            onChange={(event) => handleChange("make", event.target.value)}
            placeholder="Toyota"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchaseYear">Year</Label>
          <Input
            id="purchaseYear"
            type="number"
            min="1900"
            max="2100"
            step="1"
            value={values.purchaseYear}
            onChange={(event) => handleChange("purchaseYear", event.target.value)}
            placeholder="2026"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="purchaseValue">Purchase value</Label>
          <Input
            id="purchaseValue"
            type="number"
            min="0"
            step="0.01"
            value={values.purchaseValue}
            onChange={(event) => handleChange("purchaseValue", event.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="warrantyYears">Warranty (years)</Label>
          <Input
            id="warrantyYears"
            type="number"
            min="0"
            step="1"
            value={values.warrantyYears}
            onChange={(event) => handleChange("warrantyYears", event.target.value)}
            placeholder="2"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="geolocation">Geolocation (optional)</Label>
        <Input
          id="geolocation"
          value={values.geolocation}
          onChange={(event) => handleChange("geolocation", event.target.value)}
          placeholder="12 Ahmadu Bello Way, Kaduna"
        />
        <p className="text-xs text-muted-foreground">Physical address or location description — leave blank if not recorded.</p>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={saving || (!!categoryError && !loadingCategories)}
          className="rounded-3xl px-6 py-3"
        >
          {saving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
