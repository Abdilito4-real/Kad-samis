import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/supabase/serverHelpers';

export async function GET(req: Request) {
  try {
    const supabase = await createServerSideClient();

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);

    const { data, error } = await supabase
      .from('inspections')
      .select('*, asset:assets(id, organization_id, asset_number, name)')
      .order('inspection_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: (error as any)?.message || String(error) }, { status: 500 });
    }

    let rows = data ?? [];
    if (ctx?.profile && ctx.profile.role !== 'super_admin') {
      rows = rows.filter((r: any) => r.asset?.organization_id === ctx.profile.organization_id);
    }

    return NextResponse.json({ inspections: rows });
  } catch (err) {
    console.error('Inspections list error', err);
    return NextResponse.json({ error: 'Unable to load inspections' }, { status: 500 });
  }
}
