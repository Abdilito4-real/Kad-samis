'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { Package, Search } from 'lucide-react';
import { toast } from 'sonner';

type Asset = {
  id: string;
  name: string;
  assetNumber?: string;
  asset_tag?: string;
  category?: string;
  status?: string;
  condition?: string;
  purchase_price?: number;
  purchase_date?: string;
};

export default function OrganizationAssets({ orgId }: { orgId: string }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCondition, setFilterCondition] = useState('all');

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!orgId) {
        throw new Error('Organization ID is missing');
      }

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

      const response = await fetch(`/api/admin/organizations/${encodeURIComponent(orgId)}/metrics`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          Accept: 'application/json',
        },
      });
      const data = await response.json();

      if (!response.ok) {
        const message = data?.error || 'Failed to fetch assets';
        setError(message);
        toast.error(message);
        setAssets([]);
      } else {
        setAssets(data.assets || []);
      }
    } catch (error: any) {
      toast.error('Failed to load assets');
      console.error(error);
      setError(error?.message || 'Unable to load assets');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const filteredAssets = assets.filter(asset => {
    const lowerSearch = search.toLowerCase();
    const matchesSearch = asset.name?.toLowerCase().includes(lowerSearch) ||
      asset.asset_tag?.toLowerCase().includes(lowerSearch) ||
      asset.assetNumber?.toLowerCase().includes(lowerSearch);
    const matchesCondition = filterCondition === 'all' || asset.condition === filterCondition;
    return matchesSearch && matchesCondition;
  });

  const conditionColor: Record<string, string> = {
    excellent: 'bg-emerald-500/10 text-emerald-500',
    good: 'bg-sky-500/10 text-sky-500',
    fair: 'bg-amber-500/10 text-amber-600',
    poor: 'bg-orange-500/10 text-orange-500',
    damaged: 'bg-rose-500/10 text-rose-500',
  };

  const statusColor: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-500',
    inactive: 'bg-muted text-muted-foreground',
    maintenance: 'bg-amber-500/10 text-amber-600',
    disposal: 'bg-rose-500/10 text-rose-500',
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or asset tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={filterCondition}
          onChange={e => setFilterCondition(e.target.value)}
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
        >
          <option value="all">All Conditions</option>
          <option value="excellent">Excellent</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
          <option value="damaged">Damaged</option>
        </select>
      </div>

      {/* Assets List */}
      {filteredAssets.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">
            {error ? `Error: ${error}` : (assets.length === 0 ? 'No assets found' : 'No assets match your search')}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAssets.map(asset => (
            <Card key={asset.id} className="p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-5 h-5 text-muted-foreground" />
                    <h4 className="font-semibold">{asset.name}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Tag: {asset.asset_tag || asset.assetNumber || 'N/A'} • Category: {asset.category || 'N/A'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {asset.condition && (
                      <Badge className={conditionColor[asset.condition] || 'bg-muted text-muted-foreground'}>
                        {asset.condition.charAt(0).toUpperCase() + asset.condition.slice(1)}
                      </Badge>
                    )}
                    {asset.status && (
                      <Badge className={statusColor[asset.status] || 'bg-muted text-muted-foreground'}>
                        {asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {asset.purchase_price && (
                    <p className="text-sm font-semibold text-green-600">
                      ₦{asset.purchase_price.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                    </p>
                  )}
                  {asset.purchase_date && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(asset.purchase_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pt-2">
        Showing {filteredAssets.length} of {assets.length} assets
      </p>
    </div>
  );
}
