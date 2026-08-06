import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerSideClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No authenticated user' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, organization_id, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ user: { id: user.id, email: user.email }, profile });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to inspect profile' }, { status: 500 });
  }
}
