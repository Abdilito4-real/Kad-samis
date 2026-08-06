"use client";

// React not required for this component
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function OrganizationSearch({ query, setQuery }: { query: string; setQuery: (s: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search organizations..."
        className="input input-bordered w-80"
      />
      <Link href="/admin/organizations/create" className="btn btn-primary">
        <Plus className="mr-2 h-4 w-4" />
        Register Organization
      </Link>
    </div>
  );
}
