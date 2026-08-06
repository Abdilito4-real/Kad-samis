import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest } from '@/lib/supabase/serverHelpers';

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseFromRequest(req) ?? (await createServerSideClient());
    const ctx = await getProfile(supabase, req);

    if (!ctx?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      const { data, error } = await supabase.from('organizations').select('*, profiles(*), assets(id)');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ organizations: data });
    }
  } catch (err) {
    console.warn('Supabase not configured or failed, falling back to empty list', err);
  }

  return NextResponse.json({ organizations: [] });
}
