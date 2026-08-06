import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest } from '@/lib/supabase/serverHelpers';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { endpoint, p256dh, auth, userAgent } = body;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'endpoint, p256dh, and auth are required' }, { status: 400 });
    }

    let supabase = getSupabaseFromRequest(req);
    if (!supabase) {
      supabase = await createServerSideClient();
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);
    if (!ctx?.profile || !ctx.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: ctx.user.id,
          endpoint,
          p256dh,
          auth,
          user_agent: typeof userAgent === 'string' ? userAgent.slice(0, 500) : null,
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('Push subscribe error', err);
    return NextResponse.json({ error: 'Unable to save push subscription' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
    }

    let supabase = getSupabaseFromRequest(req);
    if (!supabase) {
      supabase = await createServerSideClient();
    }

    const ctx = await getProfile(supabase, req);
    if (!ctx?.profile || !ctx.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', ctx.user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Push unsubscribe error', err);
    return NextResponse.json({ error: 'Unable to remove push subscription' }, { status: 500 });
  }
}
