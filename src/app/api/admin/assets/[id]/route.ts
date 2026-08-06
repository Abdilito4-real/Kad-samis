import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest, writeAudit } from '@/lib/supabase/serverHelpers';

const ASSET_COLUMNS =
  'id, asset_number, name, category_id, condition, status, manufacturer, model, serial_number, purchase_date, purchase_price, current_value, warranty_expiry, funding_source, notes, organization_id, created_at, updated_at';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseFromRequest(req) ?? (await createServerSideClient());

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);
    if (!ctx?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: asset, error } = await supabase
      .from('assets')
      .select(ASSET_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Org admins may only view assets that belong to their own organization.
    if (ctx.profile.role !== 'super_admin' && asset.organization_id !== ctx.profile.organization_id) {
      return NextResponse.json({ error: 'You do not have access to this asset' }, { status: 403 });
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error('Asset fetch failed', error);
    return NextResponse.json({ error: 'Unable to load asset' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabaseFromRequest(req) ?? (await createServerSideClient());

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);
    if (!ctx?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (ctx.profile.role === 'super_admin') {
      return NextResponse.json({ error: 'Super admins have read-only access to assets' }, { status: 403 });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('assets')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    if (existing.organization_id !== ctx.profile.organization_id) {
      return NextResponse.json({ error: 'You do not have access to this asset' }, { status: 403 });
    }

    const payload: Record<string, unknown> = {
      updated_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    };
    if (body.assetNumber !== undefined) payload.asset_number = body.assetNumber;
    if (body.name !== undefined) payload.name = body.name;
    if (body.categoryId !== undefined) payload.category_id = body.categoryId;
    if (body.condition !== undefined) payload.condition = body.condition;
    if (body.status !== undefined) payload.status = body.status;
    if (body.manufacturer !== undefined) payload.manufacturer = body.manufacturer || null;
    if (body.model !== undefined) payload.model = body.model || null;
    if (body.serialNumber !== undefined) payload.serial_number = body.serialNumber || null;
    if (body.purchaseDate !== undefined) payload.purchase_date = body.purchaseDate || null;
    if (body.purchasePrice !== undefined) payload.purchase_price = body.purchasePrice ? Number(body.purchasePrice) : null;
    if (body.currentValue !== undefined) payload.current_value = body.currentValue ? Number(body.currentValue) : null;
    if (body.warrantyExpiry !== undefined) payload.warranty_expiry = body.warrantyExpiry || null;
    if (body.fundingSource !== undefined) payload.funding_source = body.fundingSource || null;
    if (body.notes !== undefined) payload.notes = body.notes || null;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const serviceRoleClient = serviceRoleKey && process.env.NEXT_PUBLIC_SUPABASE_URL
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

    const { data, error } = await (serviceRoleClient ?? supabase)
      .from('assets')
      .update(payload)
      .eq('id', id)
      .select(ASSET_COLUMNS)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await writeAudit(serviceRoleClient ?? supabase, req, {
        action: 'update',
        table_name: 'assets',
        record_id: id,
        old_values: existing,
        new_values: data,
        user_id: ctx.user?.id ?? null,
      });
    } catch (err) {
      console.warn('Failed to write asset update audit:', err);
    }

    return NextResponse.json({ asset: data });
  } catch (error) {
    console.error('Asset update failed', error);
    return NextResponse.json({ error: 'Unable to update asset' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseFromRequest(req) ?? (await createServerSideClient());

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);
    if (!ctx?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (ctx.profile.role === 'super_admin') {
      return NextResponse.json({ error: 'Super admins have read-only access to assets' }, { status: 403 });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('assets')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    if (existing.organization_id !== ctx.profile.organization_id) {
      return NextResponse.json({ error: 'You do not have access to this asset' }, { status: 403 });
    }

    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await writeAudit(supabase, req, {
        action: 'delete',
        table_name: 'assets',
        record_id: id,
        old_values: existing,
        new_values: {},
        user_id: ctx.user?.id ?? null,
      });
    } catch (err) {
      console.warn('Failed to write asset delete audit:', err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Asset delete failed', error);
    return NextResponse.json({ error: 'Unable to delete asset' }, { status: 500 });
  }
}
