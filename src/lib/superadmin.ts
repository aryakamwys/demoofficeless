import { createServerClient } from "@/lib/supabase-server";

// Daftar email superadmin dari env (server-only, koma-separator).
// Env dipilih daripada tabel roles karena user login dikelola Supabase auth.
export function isSuperadminEmail(email?: string | null) {
  if (!email) return false;
  const list = (process.env.SUPERADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

// User yang sedang login, hanya jika dia superadmin — null jika bukan/anonymous.
export async function getSuperadminUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && isSuperadminEmail(user.email) ? user : null;
}
