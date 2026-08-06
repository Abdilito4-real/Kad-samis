'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function OrganizationStatisticsRedirectPage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();

  useEffect(() => {
    const id = params?.id;
    if (id) {
      router.replace(`/admin/organizations/${id}?tab=statistics`);
    }
  }, [params, router]);

  return null;
}
