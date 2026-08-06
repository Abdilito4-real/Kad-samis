"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  manufacturer: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  purchasePrice: string;
  currentValue: string;
  warrantyExpiry: string;
  fundingSource: string;
  notes: string;
}

const defaultValues: AssetFormValues = {
  assetNumber: "",
  name: "",
  categoryId: "",
  condition: "good",
  status: "active",
  manufacturer: "",
  model: "",
  serialNumber: "",
  purchaseDate: "",
  purchasePrice: "",
  currentValue: "",
  warrantyExpiry: "",
  fundingSource: "",
  notes: "",
};

const conditions = ["excellent", "good", "fair", "poor", "damaged"];
const statuses = ["active", "inactive", "maintenance", "disposal", "archived"];

interface Props {
  initialValues?: Partial<AssetFormValues>;
  onSubmit: (values: AssetFormValues) => Promise<void>;
  submitLabel: string;
}

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
          <Label htmlFor="assetNumber">Asset number</Label>
          <Input
            id="assetNumber"
            value={values.assetNumber}
            onChange={(event) => handleChange("assetNumber", event.target.value)}
            placeholder="KD-2026-001"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Asset name</Label>
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
          <select
            id="categoryId"
            value={values.categoryId}
            onChange={(event) => handleChange("categoryId", event.target.value)}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            required
            disabled={loadingCategories || categories.length === 0}
          >
            {loadingCategories ? (
              <option value="" disabled>
                Loading categories...
              </option>
            ) : categories.length === 0 ? (
              <option value="" disabled>
                No categories available
              </option>
            ) : (
              <>
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </>
            )}
          </select>
          {categoryError ? (
            <p className="mt-2 text-sm text-red-500">{categoryError}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="condition">Condition</Label>
          <select
            id="condition"
            value={values.condition}
            onChange={(event) => handleChange("condition", event.target.value)}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            required
          >
            {conditions.map((condition) => (
              <option key={condition} value={condition}>
                {condition.charAt(0).toUpperCase() + condition.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={values.status}
            onChange={(event) => handleChange("status", event.target.value)}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            required
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input
            id="manufacturer"
            value={values.manufacturer}
            onChange={(event) => handleChange("manufacturer", event.target.value)}
            placeholder="Caterpillar"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            value={values.model}
            onChange={(event) => handleChange("model", event.target.value)}
            placeholder="X5000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="serialNumber">Serial number</Label>
          <Input
            id="serialNumber"
            value={values.serialNumber}
            onChange={(event) => handleChange("serialNumber", event.target.value)}
            placeholder="SN-00012345"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="purchaseDate">Purchase date</Label>
          <Input
            id="purchaseDate"
            type="date"
            value={values.purchaseDate}
            onChange={(event) => handleChange("purchaseDate", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchasePrice">Purchase price</Label>
          <Input
            id="purchasePrice"
            type="number"
            min="0"
            step="0.01"
            value={values.purchasePrice}
            onChange={(event) => handleChange("purchasePrice", event.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentValue">Current value</Label>
          <Input
            id="currentValue"
            type="number"
            min="0"
            step="0.01"
            value={values.currentValue}
            onChange={(event) => handleChange("currentValue", event.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="warrantyExpiry">Warranty expiry</Label>
          <Input
            id="warrantyExpiry"
            type="date"
            value={values.warrantyExpiry}
            onChange={(event) => handleChange("warrantyExpiry", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fundingSource">Funding source</Label>
          <Input
            id="fundingSource"
            value={values.fundingSource}
            onChange={(event) => handleChange("fundingSource", event.target.value)}
            placeholder="Government budget"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={values.notes}
          onChange={(event) => handleChange("notes", event.target.value)}
          placeholder="Additional asset details"
          rows={4}
        />
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
