import { NextResponse } from 'next/server';
import { getSupabaseFromRequest, createSupabase } from '@/lib/supabase/serverHelpers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.toString().trim();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = getSupabaseFromRequest(request) ?? (await createSupabase());
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}`}/auth/reset-password`,
    });

    if (error) {
      console.error('Password reset request failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send password reset failed:', error);
    return NextResponse.json({ error: 'Unable to send password reset' }, { status: 500 });
  }
}
