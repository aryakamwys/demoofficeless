import { createServerClient as createServerSupabaseClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export async function createServerClient() {
  const cookieStore = await cookies();

  return createServerSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — ignore
          }
        },
      },
    }
  );
}

// Client service-role bersifat stateless (fetch, tanpa session) — dibuat
// sekali per proses, bukan per request, supaya tidak ada alokasi objek
// berulang di setiap route yang memakainya.
let serviceClientSingleton: SupabaseClient | null = null;

export function createServiceClient() {
  if (!serviceClientSingleton) {
    serviceClientSingleton = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return serviceClientSingleton;
}
