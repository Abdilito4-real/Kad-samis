"use client";

// React not required for this component
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCcw, Upload, Plus } from 'lucide-react';

type Props = {
  typeFilter: string;
  statusFilter: string;
  sort: string;
  onTypeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onCreate: () => void;
  onRefresh: () => void;
};

export default function OrganizationSidebar({
  typeFilter,
  statusFilter,
  sort,
  onTypeChange,
  onStatusChange,
  onSortChange,
  onCreate,
  onRefresh,
}: Props) {
  return (
    <aside className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
      <Card className="mb-4 border-none bg-transparent p-0">
        <CardHeader className="p-0">
          <CardTitle className="text-base">Quick actions</CardTitle>
          <CardDescription>Register, refresh or export organizations instantly.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-4 space-y-3">
          <Button variant="default" size="default" className="w-full justify-start" onClick={onCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Register Organization
          </Button>
          <Button variant="outline" size="default" className="w-full justify-start" onClick={onRefresh}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh List
          </Button>
          <Button variant="outline" size="default" className="w-full justify-start">
            <Upload className="mr-2 h-4 w-4" />
            Export
          </Button>
        </CardContent>
      </Card>

      <Card className="border-none bg-transparent p-0">
        <CardHeader className="p-0">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Refine the organization list by type, status, or sort order.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Organization type</label>
            <select value={typeFilter} onChange={(e) => onTypeChange(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/10">
              <option value="ALL">All</option>
              <option value="MINISTRY">Ministry</option>
              <option value="DEPARTMENT">Department</option>
              <option value="AGENCY">Agency</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Status</label>
            <select value={statusFilter} onChange={(e) => onStatusChange(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/10">
              <option value="ALL">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Sort by</label>
            <select value={sort} onChange={(e) => onSortChange(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/10">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="az">A - Z</option>
              <option value="updated">Recently updated</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none bg-transparent p-0">
        <CardHeader className="p-0">
          <CardTitle className="text-base">Need help?</CardTitle>
          <CardDescription>Use this panel to quickly manage MDAs and monitor their status.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-4 text-sm text-muted-foreground">
          • Use the search field to locate any organization by name, email or phone.
          <br />
          • Open an MDA card to manage administration details.
          <br />
          • Register new organizations from the top action button.
        </CardContent>
      </Card>
    </aside>
  );
}
