import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSideClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Use the anon key for session-aware auth so RLS can see the logged-in user.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || serviceKey!;

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            // Handle server-side cookie setting errors
          }
        },
        remove(name: string) {
          try {
            cookieStore.delete(name);
          } catch (error) {
            // Handle server-side cookie deletion errors
          }
        },
      },
    }
  );
}
