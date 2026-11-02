import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest } from '@/lib/supabase/serverHelpers';

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseFromRequest(req) ?? (await createServerSideClient());
    const ctx = await getProfile(supabase, req);

    if (!ctx?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && (serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      if (new URL(req.url).searchParams.get('forAssetImport') === 'true') {
        if (ctx.profile.role !== 'super_admin') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const organizationClient = serviceRoleKey
          ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
              auth: { persistSession: false, autoRefreshToken: false },
            })
          : supabase;
        const { data, error } = await organizationClient.from('organizations').select('id, name').order('name');
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ organizations: data });
      }

      const { data, error } = await supabase.from('organizations').select('*, profiles(*), assets(id)');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ organizations: data });
    }
  } catch (err) {
    console.error('Organizations fetch failed', err);
    return NextResponse.json({ error: 'Unable to load organizations' }, { status: 500 });
  }

  return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
}
