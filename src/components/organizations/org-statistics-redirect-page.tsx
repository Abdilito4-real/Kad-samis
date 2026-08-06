import { redirect } from 'next/navigation';

// This standalone page used to render OrganizationStatistics on its own,
// with no sidebar or other tabs — you'd lose access to Management/Security/
// Danger Zone while viewing it. Every button that used to link here now
// points at the full tabbed page instead (?tab=statistics). This route is
// kept only as a redirect so any old bookmark or stray link still lands
// somewhere correct rather than 404ing.
export default async function OrganizationStatisticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/organizations/${id}?tab=statistics`);
  return null;
}