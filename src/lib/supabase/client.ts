import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let browserSupabaseClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (typeof window === "undefined") {
    return null;
  }

  if (browserSupabaseClient) {
    return browserSupabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  browserSupabaseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  });

  return browserSupabaseClient;
}
