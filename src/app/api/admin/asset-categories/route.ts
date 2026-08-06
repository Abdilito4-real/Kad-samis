import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const usingServiceRole = !!serviceRoleKey;

    console.log('GET /api/admin/asset-categories called', {
      supabaseUrl: supabaseUrl ?? null,
      usingServiceRole,
    });

    if (!supabaseUrl || !(serviceRoleKey || anonKey)) {
      console.log('asset-categories: supabase env missing or incomplete');
      return NextResponse.json({ categories: [] });
    }

    const supabase = usingServiceRole
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : await createServerSideClient();

    const { data, error } = await supabase.from('asset_categories').select('id, name, code').order('name');
    console.log('asset-categories query result', { count: data?.length ?? 0, error: error?.message ?? null });

    // Diagnostic: if service role key exists, run a direct query with it to ensure the service-role connection
    // points to the same project/database (does not log secrets).
    if (serviceRoleKey && supabaseUrl) {
      try {
        const directClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: directData, error: directError } = await directClient.from('asset_categories').select('id').limit(1);
        console.log('asset-categories direct service-role query', { directCount: directData?.length ?? 0, directError: directError?.message ?? null });
      } catch (err) {
        console.error('asset-categories direct query failed', err);
      }
    }

    if (error) {
      console.error('Asset categories fetch failed', error);
      return NextResponse.json({ categories: [] });
    }

    if (!data?.length) {
      console.log('asset-categories: no rows returned');
    }

    return NextResponse.json({ categories: data ?? [] });
  } catch (error) {
    console.error('Asset categories fetch failed', error);
    return NextResponse.json({ categories: [] });
  }
}
