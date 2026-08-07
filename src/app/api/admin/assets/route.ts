import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/supabase/serverHelpers';
import { ASSET_CONDITIONS, ASSET_STATUSES } from '@/lib/assetImport';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

interface BulkAssetRow {
  rowNumber: number;
  assetNumber: string;
  name: string;
  make: string | null;
  purchaseYear: number | null;
  purchaseValue: number | null;
  condition: string;
  warrantyYears: number | null;
  status: string;
  categoryId: string;
}

interface SkippedRow {
  rowNumber: number;
  assetNumber: string;
  reasons: string[];
}

async function getProfile(supabase: any, req?: Request) {
  const authHeader = req?.headers.get('authorization');
  const accessToken = authHeader?.replace(/^Bearer\s+/i, '').trim();

  let user = null;
  let profileClient = supabase;

  if (accessToken) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && anonKey) {
      const tokenClient = createClient(supabaseUrl, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });

      const { data: tokenUserData, error: tokenUserError } = await tokenClient.auth.getUser(accessToken);

      if (!tokenUserError && tokenUserData?.user) {
        user = tokenUserData.user;
        profileClient = tokenClient;
      } else {
        console.warn('Token-based user lookup failed', tokenUserError?.message);
      }
    }
  }

  if (!user) {
    const {
      data: { user: fallbackUser },
      error: authError,
    } = await supabase.auth.getUser();

    user = fallbackUser;
    if (authError) {
      console.warn('Session-based user lookup failed', authError.message);
    }
  }

  if (!user) return null;

  const { data: profile, error: profileError } = await profileClient
    .from('profiles')
    .select('id, organization_id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Profile lookup failed', profileError);
    return null;
  }

  return { user, profile, authClient: profileClient };
}

export async function GET(req: Request) {
  try {
    const supabase = await createServerSideClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);

    if (!ctx?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ctx?.profile) {
      console.error('Authenticated user has no profile', { userId: ctx.user.id });
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    }

    if (!ctx.profile.organization_id && ctx.profile.role !== 'super_admin') {
      return NextResponse.json(
        {
          error: 'User profile incomplete. Organization assignment required.',
          details: 'organization_id is not set',
        },
        { status: 403 }
      );
    }

    const queryClient = ctx?.authClient ?? supabase;

    let query = queryClient
      .from('assets')
      .select(
        'id, asset_number, name, status, condition, make, purchase_year, purchase_value, warranty_years, created_at, organization_id, asset_categories(name)'
      )
      .order('created_at', { ascending: false });

    // Only super_admin can see all assets; org admins see only their organization's assets
    if (ctx.profile.role !== 'super_admin' && ctx.profile.organization_id) {
      query = query.eq('organization_id', ctx.profile.organization_id);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assets: data });
  } catch (error) {
    console.error('Assets fetch failed', error);
    return NextResponse.json({ error: 'Unable to load assets' }, { status: 500 });
  }
}

// Assets are created exclusively via CSV import now — this always inserts
// a batch (a single-row import is just a batch of one). Each row is
// re-validated server-side (required fields, enum values, category
// existence, duplicate asset numbers — both within the file and against
// what's already in the table) rather than trusting the client's own
// validation, since this endpoint can be called directly.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rows: BulkAssetRow[] = Array.isArray(body?.rows) ? body.rows : [];
    const supabase = await createServerSideClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);
    if (!ctx?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (ctx.profile.role === 'super_admin') {
      return NextResponse.json({ error: 'Super admins have read-only access to assets' }, { status: 403 });
    }

    if (!ctx.profile.organization_id) {
      return NextResponse.json({ error: 'Your account has no organization assigned' }, { status: 403 });
    }

    const rateLimit = await checkRateLimit('bulk-import', ctx.user.id);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const serviceRoleClient = serviceRoleKey && process.env.NEXT_PUBLIC_SUPABASE_URL
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : null;

    // ctx.authClient is whichever client actually authenticated as this
    // user (the bearer-token client, when the frontend sends one — which
    // it does). Falling back to the plain cookie-based `supabase` here
    // instead would run every query below as an unauthenticated `anon`
    // connection whenever there's no session cookie, and RLS would reject
    // the insert outright since auth.uid() comes back NULL.
    const db = serviceRoleClient ?? ctx.authClient ?? supabase;

    // Validate category ids up front so a bad/renamed category doesn't
    // surface as an opaque insert error per-row.
    const categoryIds = Array.from(new Set(rows.map((r) => r.categoryId).filter(Boolean)));
    const { data: validCategories, error: categoryError } = await db
      .from('asset_categories')
      .select('id')
      .in('id', categoryIds.length ? categoryIds : ['00000000-0000-0000-0000-000000000000']);

    if (categoryError) {
      return NextResponse.json({ error: categoryError.message }, { status: 500 });
    }
    const validCategoryIdSet = new Set((validCategories ?? []).map((c: any) => c.id));

    // Existing asset numbers this batch collides with (asset_number is
    // globally unique, not just within the organization).
    const candidateNumbers = Array.from(new Set(rows.map((r) => r.assetNumber).filter(Boolean)));
    const { data: existingAssets, error: existingError } = await db
      .from('assets')
      .select('asset_number')
      .in('asset_number', candidateNumbers.length ? candidateNumbers : ['__none__']);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    const existingNumberSet = new Set((existingAssets ?? []).map((a: any) => a.asset_number));

    const seenInBatch = new Set<string>();
    const skipped: SkippedRow[] = [];
    const toInsert: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      const reasons: string[] = [];

      if (!row.name?.trim()) reasons.push('Assets Name is required');
      if (!row.assetNumber?.trim()) reasons.push('Assets ID or Number is required');
      if (!row.condition || !ASSET_CONDITIONS.includes(row.condition as any)) reasons.push('Condition is missing or invalid');
      if (row.status && !ASSET_STATUSES.includes(row.status as any)) reasons.push('Status is invalid');
      if (!row.categoryId || !validCategoryIdSet.has(row.categoryId)) reasons.push('Category is missing or unrecognized');

      if (row.assetNumber) {
        if (existingNumberSet.has(row.assetNumber)) {
          reasons.push(`Asset number "${row.assetNumber}" already exists`);
        } else if (seenInBatch.has(row.assetNumber)) {
          reasons.push(`Duplicate asset number "${row.assetNumber}" elsewhere in this file`);
        }
      }

      if (reasons.length > 0) {
        skipped.push({ rowNumber: row.rowNumber, assetNumber: row.assetNumber, reasons });
        continue;
      }

      seenInBatch.add(row.assetNumber);
      toInsert.push({
        asset_number: row.assetNumber,
        name: row.name,
        category_id: row.categoryId,
        condition: row.condition,
        status: row.status || 'active',
        make: row.make || null,
        purchase_year: row.purchaseYear ?? null,
        purchase_value: row.purchaseValue ?? null,
        warranty_years: row.warrantyYears ?? null,
        organization_id: ctx.profile.organization_id,
        created_by: ctx.user.id,
      });
    }

    let created: any[] = [];
    if (toInsert.length > 0) {
      const { data, error } = await db.from('assets').insert(toInsert).select('*');
      if (error) {
        console.error('Asset bulk insert failed', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      created = data ?? [];
    }

    if (created.length > 0) {
      try {
        await writeAudit(db, req, {
          action: 'insert',
          table_name: 'assets',
          record_id: null,
          old_values: {},
          new_values: { imported: created.length, asset_numbers: created.map((a) => a.asset_number) },
          user_id: ctx.user?.id ?? null,
        });
      } catch (err) {
        console.warn('Failed to write asset import audit:', err);
      }
    }

    return NextResponse.json({ created, skipped });
  } catch (error) {
    console.error('Asset import failed', error);
    return NextResponse.json({ error: 'Unable to import assets' }, { status: 500 });
  }
}
