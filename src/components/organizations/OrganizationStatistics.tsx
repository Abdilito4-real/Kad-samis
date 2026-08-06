'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Plugin } from 'chart.js';
import { TrendingUp, AlertTriangle, CheckCircle, Search, Package, Info, PieChart } from 'lucide-react';
import { toast } from 'sonner';

ChartJS.register(ArcElement, Tooltip, Legend);

type AssetViewMode = 'details' | 'depreciation';

// Segmented icon toggle for picking which panel a row's "view" opens —
// shared between the sm+ table and the mobile card list so both stay in
// sync visually instead of drifting into two subtly different controls.
function AssetViewToggle({
  isSelected,
  isAssetPanelOpen,
  assetViewMode,
  onSelect,
}: {
  isSelected: boolean;
  isAssetPanelOpen: boolean;
  assetViewMode: AssetViewMode;
  onSelect: (mode: AssetViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-1">
      <button
        type="button"
        title="View asset details"
        aria-label="View asset details"
        aria-pressed={isSelected && isAssetPanelOpen && assetViewMode === 'details'}
        onClick={() => onSelect('details')}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full transition',
          isSelected && isAssetPanelOpen && assetViewMode === 'details'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="View depreciation breakdown"
        aria-label="View depreciation breakdown"
        aria-pressed={isSelected && isAssetPanelOpen && assetViewMode === 'depreciation'}
        onClick={() => onSelect('depreciation')}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full transition',
          isSelected && isAssetPanelOpen && assetViewMode === 'depreciation'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <PieChart className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const getTextColor = (bgColor: string) => {
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#0f172a' : '#ffffff';
};

// Custom plugin to draw percentage labels inside doughnut slices
const sliceLabelPlugin: Plugin<'doughnut'> = {
  id: 'sliceLabelPlugin',
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    const dataset = chart.data.datasets[0];
    if (!dataset) return;
    const data = dataset.data as number[];
    const total = data.reduce((s, v) => s + (Number(v) || 0), 0);
    if (!total) return;

    const backgroundColors = Array.isArray(dataset.backgroundColor)
      ? (dataset.backgroundColor as string[])
      : [];

    const meta = chart.getDatasetMeta(0);
    ctx.save();
    meta.data.forEach((arc, i) => {
      const value = Number(data[i]) || 0;
      if (!value) return;
      const startAngle = (arc as any).startAngle as number;
      const endAngle = (arc as any).endAngle as number;
      const angle = (startAngle + endAngle) / 2;
      const innerRadius = (arc as any).innerRadius as number;
      const outerRadius = (arc as any).outerRadius as number;
      const radius = (innerRadius + outerRadius) / 2;
      const x = (arc as any).x + Math.cos(angle) * radius;
      const y = (arc as any).y + Math.sin(angle) * radius;

      const percent = Math.round((value / total) * 100);
      const bgColor = backgroundColors[i] || '#0ea5e9';
      const textColor = getTextColor(bgColor);

      ctx.font = '600 12px Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = textColor === '#ffffff' ? 'rgba(0,0,0,0.4)' : '#ffffff';
      ctx.strokeText(`${percent}%`, x, y);
      ctx.fillStyle = textColor;
      ctx.fillText(`${percent}%`, x, y);
    });
    ctx.restore();
  },
};

ChartJS.register(sliceLabelPlugin);

type AssetMetric = {
  id: string;
  name: string;
  originalValue: number;
  currentValue: number;
  accumulatedDepreciation: number;
  condition?: string;
};

type Statistics = {
  totalAssets?: number;
  totalOriginalValue?: number;
  totalCurrentValue?: number;
  totalAccumulatedDepreciation?: number;
  depreciationPercentage?: number;
  assetsByCondition?: Record<string, number>;
  assets?: AssetMetric[];
};

type Tone = 'neutral' | 'emerald' | 'sky' | 'amber' | 'rose';

const TONE_STYLES: Record<Tone, { rail: string; chip: string; icon: string }> = {
  neutral: { rail: 'bg-slate-400', chip: 'bg-slate-500/10', icon: 'text-slate-500' },
  emerald: { rail: 'bg-emerald-500', chip: 'bg-emerald-500/10', icon: 'text-emerald-500' },
  sky: { rail: 'bg-sky-500', chip: 'bg-sky-500/10', icon: 'text-sky-500' },
  amber: { rail: 'bg-amber-500', chip: 'bg-amber-500/10', icon: 'text-amber-600' },
  rose: { rail: 'bg-rose-500', chip: 'bg-rose-500/10', icon: 'text-rose-500' },
};

// Same condition vocabulary already used for the badges, extended to a bar
// color and a hex value for the "current condition" accent — so the
// condition drives color everywhere it's shown instead of just the badge.
const CONDITION_STYLES: Record<string, { badge: string; bar: string; hex: string }> = {
  excellent: { badge: 'bg-emerald-500/10 text-emerald-500', bar: 'bg-emerald-500', hex: '#10b981' },
  good: { badge: 'bg-sky-500/10 text-sky-500', bar: 'bg-sky-500', hex: '#0ea5e9' },
  fair: { badge: 'bg-amber-500/10 text-amber-600', bar: 'bg-amber-500', hex: '#f59e0b' },
  poor: { badge: 'bg-orange-500/10 text-orange-500', bar: 'bg-orange-500', hex: '#f97316' },
  damaged: { badge: 'bg-rose-500/10 text-rose-500', bar: 'bg-rose-500', hex: '#f43f5e' },
};
const FALLBACK_CONDITION = { badge: 'bg-muted text-muted-foreground', bar: 'bg-slate-400', hex: '#94a3b8' };

export default function OrganizationStatistics({ orgId }: { orgId: string }) {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetViewMode, setAssetViewMode] = useState<'details' | 'depreciation'>('details');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAssetPanelOpen, setIsAssetPanelOpen] = useState(false);

  const fetchStatistics = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/admin/organizations/${orgId}/metrics`, {
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.error || 'Failed to fetch statistics');
      }

      const finalStats = responseData.summary
        ? { ...responseData.summary, assets: responseData.assets }
        : responseData;
      setStats(finalStats);
    } catch (error: any) {
      toast.error('Failed to load statistics');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  useEffect(() => {
    if (!selectedAssetId && stats?.assets?.length) {
      setSelectedAssetId(stats.assets[0].id);
    }
  }, [stats, selectedAssetId]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">No statistics available</p>
      </Card>
    );
  }

  const assetColors = stats.assets?.map((_, index) => {
    const palette = [
      '#2563eb',
      '#22c55e',
      '#0ea5e9',
      '#8b5cf6',
      '#f97316',
      '#eab308',
      '#ec4899',
      '#14b8a6',
    ];
    return palette[index % palette.length];
  }) || ['#0ea5e9', '#0284c7'];

  const searchQueryLower = searchQuery.trim().toLowerCase();
  const filteredAssets = stats.assets?.filter((asset) => {
    const searchable = [asset.name, asset.condition || ''].join(' ').toLowerCase();
    return searchable.includes(searchQueryLower);
  }) ?? [];

  const selectedAsset = filteredAssets.find((asset) => asset.id === selectedAssetId) || filteredAssets[0] || stats.assets?.[0];
  const selectedAssetIndex = selectedAsset ? stats.assets?.findIndex((asset) => asset.id === selectedAsset.id) ?? 0 : 0;
  const selectedAssetData = selectedAsset
    ? [selectedAsset.currentValue, selectedAsset.accumulatedDepreciation]
    : [];
  const selectedAssetLabels = selectedAsset ? ['Current Value', 'Accumulated Depreciation'] : [];
  const selectedAssetColors = [assetColors[selectedAssetIndex % assetColors.length], '#64748b'];

  const conditionEntries = Object.entries(stats.assetsByCondition || {});

  const depreciationRate = stats.depreciationPercentage ?? 0;
  // Depreciation rate isn't inherently "bad" at any level, but a high rate
  // is worth flagging the same way we treat other attention metrics
  // elsewhere in the app — this ties the badge color to the actual number
  // instead of a flat amber regardless of whether it's 5% or 85%.
  const rateTone: Tone = depreciationRate >= 60 ? 'rose' : depreciationRate >= 30 ? 'amber' : 'emerald';

  const financialCards: Array<{ title: string; value: string | number; detail: string; icon: any; tone: Tone }> = [
    {
      title: 'Total Assets',
      value: stats.totalAssets || 0,
      detail: 'in inventory',
      icon: Package,
      tone: 'neutral',
    },
    {
      title: 'Original Value',
      value: `₦${(stats.totalOriginalValue || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`,
      detail: 'acquisition cost',
      icon: CheckCircle,
      tone: 'sky',
    },
    {
      title: 'Current Value',
      value: `₦${(stats.totalCurrentValue || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`,
      detail: 'after depreciation',
      icon: TrendingUp,
      tone: 'emerald',
    },
    {
      title: 'Total Depreciation',
      value: `₦${(stats.totalAccumulatedDepreciation || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`,
      detail: `${depreciationRate.toFixed(1)}% of value lost`,
      icon: AlertTriangle,
      tone: rateTone,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {financialCards.map((card) => {
          const Icon = card.icon;
          const tone = TONE_STYLES[card.tone];
          return (
            <Card key={card.title} className="relative overflow-hidden p-4 pl-5">
              <span className={`absolute left-0 top-0 h-full w-1 ${tone.rail}`} aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums">{card.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.chip} ${tone.icon}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Asset Condition Distribution */}
      <Card className="p-6">
        <div>
          <h3 className="text-lg font-semibold">Asset Condition Distribution</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.totalAssets || 0} assets across {conditionEntries.filter(([, count]) => count > 0).length} condition{conditionEntries.filter(([, count]) => count > 0).length === 1 ? '' : 's'}
          </p>
        </div>

        {conditionEntries.every(([, count]) => count === 0) ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No asset condition data available</p>
        ) : (
          <div className="mt-5 grid grid-cols-[7rem_1fr] items-center gap-6">
            <div className="relative h-28 w-28">
              <Doughnut
                data={{
                  labels: conditionEntries.map(([condition]) => condition.charAt(0).toUpperCase() + condition.slice(1)),
                  datasets: [
                    {
                      data: conditionEntries.map(([, count]) => count),
                      backgroundColor: conditionEntries.map(([condition]) => (CONDITION_STYLES[condition] || FALLBACK_CONDITION).hex),
                      borderColor: '#0b1220',
                      borderWidth: 2,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '68%',
                  plugins: {
                    legend: { display: false },
                    // Percentage labels make sense on the larger depreciation
                    // chart but clutter a chart this small — the list beside
                    // it already carries the exact numbers.
                    sliceLabelPlugin: false as any,
                  },
                }}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold leading-none">{stats.totalAssets || 0}</span>
                <span className="mt-0.5 text-[10px] text-muted-foreground">assets</span>
              </div>
            </div>

            <div className="min-w-0 space-y-2.5">
              {conditionEntries.map(([condition, count]) => {
                const total = stats.totalAssets || 1;
                const percentage = ((count / total) * 100).toFixed(0);
                const style = CONDITION_STYLES[condition] || FALLBACK_CONDITION;
                return (
                  <div key={condition} className="flex items-center gap-2.5 text-sm">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${style.bar}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate capitalize text-foreground">{condition}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{count}</span>
                    <span className="w-9 shrink-0 text-right tabular-nums font-medium">{percentage}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Depreciation Analysis */}
      <Card className="p-6 bg-transparent border border-border">
        {/* Header bar: title on the left, search + key numbers on the right
            so filtering the table doesn't require scrolling past it first */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold">Depreciation Analysis</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Average percent of value lost across the asset portfolio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-full sm:w-52">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                id="asset-search"
                type="search"
                aria-label="Search assets"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search assets…"
                className="w-full rounded-full border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              />
            </div>
            <div className="h-8 w-px bg-border hidden sm:block" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Original Value</p>
              <p className="text-lg font-semibold">₦{(stats.totalOriginalValue || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="h-8 w-px bg-border hidden sm:block" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Average Rate</p>
              <div className="mt-0.5 flex items-center gap-2">
                <p className={`text-2xl font-bold ${TONE_STYLES[rateTone].icon}`}>{depreciationRate.toFixed(2)}%</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${TONE_STYLES[rateTone].chip} ${TONE_STYLES[rateTone].icon}`}>
                  {rateTone === 'rose' ? 'High' : rateTone === 'amber' ? 'Moderate' : 'Healthy'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Table, full width */}
        <div className="space-y-3 mb-6">
          <p className="text-xs text-muted-foreground">
            Showing {filteredAssets.length} of {stats.assets?.length ?? 0} assets
          </p>

          {/* Table — sm and up, where there's room for six columns */}
          <div className="hidden overflow-x-auto rounded-3xl border border-border bg-transparent sm:block">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-muted text-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Asset Name</th>
                  <th className="px-4 py-3 font-semibold">Original Value</th>
                  <th className="px-4 py-3 font-semibold">Current Value</th>
                  <th className="px-4 py-3 font-semibold">Depreciation</th>
                  <th className="px-4 py-3 font-semibold">Condition</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAssets.map((asset) => {
                  const isSelected = selectedAsset?.id === asset.id;
                  const conditionStyle = CONDITION_STYLES[(asset.condition || '').toLowerCase()] || FALLBACK_CONDITION;
                  return (
                    <tr key={asset.id} className={isSelected && isAssetPanelOpen ? 'bg-primary/5' : ''}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${conditionStyle.bar}`} aria-hidden />
                          {asset.name}
                        </div>
                      </td>
                      <td className="px-4 py-3">₦{asset.originalValue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3">₦{asset.currentValue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3">₦{asset.accumulatedDepreciation.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3">
                        <Badge className={conditionStyle.badge}>{asset.condition || 'Unknown'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <AssetViewToggle
                          isSelected={isSelected}
                          isAssetPanelOpen={isAssetPanelOpen}
                          assetViewMode={assetViewMode}
                          onSelect={(mode) => {
                            setSelectedAssetId(asset.id);
                            setAssetViewMode(mode);
                            setIsAssetPanelOpen(true);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Card list — below sm, where six columns can't fit side by side */}
          <div className="space-y-2 sm:hidden">
            {filteredAssets.map((asset) => {
              const isSelected = selectedAsset?.id === asset.id;
              const conditionStyle = CONDITION_STYLES[(asset.condition || '').toLowerCase()] || FALLBACK_CONDITION;
              return (
                <div
                  key={asset.id}
                  className={cn(
                    'min-w-0 rounded-2xl border border-border p-3',
                    isSelected && isAssetPanelOpen ? 'bg-primary/5' : 'bg-transparent',
                  )}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${conditionStyle.bar}`} aria-hidden />
                      <span className="min-w-0 truncate text-sm font-medium">{asset.name}</span>
                    </div>
                    <Badge className={`${conditionStyle.badge} shrink-0`}>{asset.condition || 'Unknown'}</Badge>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Original</p>
                      <p className="mt-0.5 truncate font-medium">₦{asset.originalValue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Current</p>
                      <p className="mt-0.5 truncate font-medium">₦{asset.currentValue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Depreciated</p>
                      <p className="mt-0.5 truncate font-medium">₦{asset.accumulatedDepreciation.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <AssetViewToggle
                      isSelected={isSelected}
                      isAssetPanelOpen={isAssetPanelOpen}
                      assetViewMode={assetViewMode}
                      onSelect={(mode) => {
                        setSelectedAssetId(asset.id);
                        setAssetViewMode(mode);
                        setIsAssetPanelOpen(true);
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected asset panel — hidden until a row's Details/Depreciation button is clicked */}
        {isAssetPanelOpen && selectedAsset && (
          <div className="rounded-3xl border border-border bg-transparent p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs text-muted-foreground">
                  {assetViewMode === 'details' ? 'Asset Details' : 'Depreciation Breakdown'}
                </p>
                <p className="text-lg font-semibold">{selectedAsset?.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAssetPanelOpen(false)}
                aria-label="Close panel"
                className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            {assetViewMode === 'details' ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Original Value</p>
                  <p className="text-base font-semibold">
                    ₦{selectedAsset?.originalValue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Value</p>
                  <p className="text-base font-semibold">
                    ₦{selectedAsset?.currentValue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Accumulated Depreciation</p>
                  <p className="text-base font-semibold">
                    ₦{selectedAsset?.accumulatedDepreciation.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Condition</p>
                  <Badge className={(CONDITION_STYLES[(selectedAsset?.condition || '').toLowerCase()] || FALLBACK_CONDITION).badge}>
                    {selectedAsset?.condition || 'Unknown'}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="h-64">
                  <Doughnut
                    data={{
                      labels: selectedAssetLabels,
                      datasets: [
                        {
                          data: selectedAssetData,
                          backgroundColor: selectedAssetColors,
                          borderColor: selectedAssetColors.map(() => '#0b1220'),
                          borderWidth: 1,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            color: '#cbd5e1',
                            usePointStyle: true,
                          },
                        },
                      },
                    }}
                  />
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Breakdown for {selectedAsset?.name || 'selected asset'}</p>
                  <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                    <span className="text-sm">Current Value</span>
                    <span className="text-sm font-semibold">
                      ₦{selectedAsset?.currentValue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                    <span className="text-sm">Accumulated Depreciation</span>
                    <span className="text-sm font-semibold">
                      ₦{selectedAsset?.accumulatedDepreciation.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}