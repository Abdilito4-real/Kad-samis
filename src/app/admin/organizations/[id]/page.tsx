"use client";

import { use } from 'react';
import OrganizationDetailTabs from '@/components/organizations/OrganizationDetailTabs';

export default function OrganizationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <OrganizationDetailTabs orgId={id} />;
}
