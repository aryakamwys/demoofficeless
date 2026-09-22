"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase";

// ponytail: ambil user langsung dari Supabase auth — tanpa tabel profil.
export function useSupabaseUser() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    createBrowserClient()
      .auth.getUser()
      .then(({ data }) => setUser(data.user));
  }, []);
  return user;
}

export function UserChip() {
  const user = useSupabaseUser();
  const name = user?.user_metadata?.full_name || user?.email || "User";
  const sub = user?.user_metadata?.full_name ? user.email : null;
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0].toUpperCase())
    .join("");

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
        {initials}
      </div>
      <div className="hidden min-w-0 leading-tight sm:block">
        <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
        {sub && <p className="truncate text-[11px] text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}
