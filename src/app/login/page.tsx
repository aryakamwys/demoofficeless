"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { Loader2, Lock, Mail } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError("Email atau password salah.");
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Login satu halaman penuh — tanpa kartu, kolom form terpusat.
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-fit rounded-2xl bg-blue-50 p-3">
        <Image
          src="/ogoperkom.png"
          alt="Logo Perkom"
          width={40}
          height={40}
          className="h-10 w-10 object-contain"
          priority
        />
      </div>
      <h1 className="mt-5 text-2xl font-bold text-slate-900">
        Masuk ke Officeless Perkom
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Approval klaim Grab Business — cukup dari WhatsApp.
      </p>

      <form onSubmit={handleLogin} className="mt-8 w-full max-w-sm space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              type="email"
              className="h-11 rounded-full pl-11"
              placeholder="nama@perkom.co.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type="password"
              className="h-11 rounded-full pl-11"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
        </div>

        {error && <p className="text-sm text-center text-destructive">{error}</p>}

        <Button
          type="submit"
          className="h-11 w-full rounded-full text-base"
          disabled={loading}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Masuk
        </Button>
      </form>

      <p className="mt-6 text-xs text-slate-400">
        Akun internal Perkom · hubungi HR bila belum punya akses
      </p>
    </div>
  );
}
