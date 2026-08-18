import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getKeepSignedIn } from "@/lib/sessionPersistence";

let browserSupabaseClient: ReturnType<typeof createSupabaseClient> | null = null;

// Routes each read/write to localStorage (survives closing the browser) or
// sessionStorage (cleared when the tab/browser closes) based on the "Keep
// me signed in" preference set at login time — checked dynamically per
// call rather than baked in at client-construction time, since this client
// is a module-level singleton created once per page load. Writes also
// clean up the *other* store so an earlier session persisted one way
// doesn't linger as a stale duplicate after a later sign-in chose the
// other way.
const dualStorage = {
  getItem(key: string) {
    const primary = getKeepSignedIn() ? window.localStorage : window.sessionStorage;
    const secondary = getKeepSignedIn() ? window.sessionStorage : window.localStorage;
    return primary.getItem(key) ?? secondary.getItem(key);
  },
  setItem(key: string, value: string) {
    const [primary, secondary] = getKeepSignedIn()
      ? [window.localStorage, window.sessionStorage]
      : [window.sessionStorage, window.localStorage];
    primary.setItem(key, value);
    secondary.removeItem(key);
  },
  removeItem(key: string) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

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
      storage: dualStorage,
    },
  });

  return browserSupabaseClient;
}
