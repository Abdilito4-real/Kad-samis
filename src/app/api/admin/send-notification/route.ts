import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest, writeNotifications } from '@/lib/supabase/serverHelpers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId, title, message } = body;

    if (!organizationId || !title || !message) {
      return NextResponse.json({ error: 'organizationId, title, and message are required' }, { status: 400 });
    }

    const supabase = getSupabaseFromRequest(request) ?? (await createServerSideClient());
    const ctx = await getProfile(supabase, request);
    if (!ctx?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (ctx.profile.role !== 'super_admin' && ctx.profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: recipients, error: recipientError } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', organizationId);

    if (recipientError) {
      console.error('Notification recipients query failed', recipientError);
      return NextResponse.json({ error: 'Unable to load organization recipients' }, { status: 500 });
    }

    const recipientIds = (recipients ?? []).map((profile: any) => profile.id).filter(Boolean);
    if (recipientIds.length === 0) {
      return NextResponse.json({ error: 'No recipients found for organization' }, { status: 404 });
    }

    const notifications = recipientIds.map((userId: string) => ({
      user_id: userId,
      type: 'system',
      title,
      message,
    }));

    await writeNotifications(supabase, notifications);

    return NextResponse.json({ success: true, sent: notifications.length });
  } catch (error) {
    console.error('Send notification failed', error);
    return NextResponse.json({ error: 'Unable to send notification' }, { status: 500 });
  }
}
