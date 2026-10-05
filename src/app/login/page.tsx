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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      {/* Kartu split: panel brand kiri + form putih kanan, pembatas melengkung */}
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl sm:grid-cols-2">
        {/* Panel brand */}
        <div className="relative hidden bg-blue-600 sm:block">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
            <div className="absolute -bottom-20 -left-8 h-64 w-64 rounded-full bg-white/5" />
            <div className="absolute right-10 top-1/3 h-24 w-24 rounded-full bg-white/10" />
          </div>
          <div className="relative flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <Image
                src="/ogoperkom.png"
                alt="Logo Perkom"
                width={48}
                height={48}
                className="h-12 w-12 object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-lg font-bold text-white">Officeless Perkom</p>
              <p className="mt-1 text-sm leading-relaxed text-blue-100">
                Approval klaim Grab Business — cukup dari WhatsApp.
              </p>
            </div>
          </div>
          {/* Pembatas melengkung — panel putih menonjol ke panel brand */}
          <svg
            viewBox="0 0 64 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute right-0 top-0 h-full w-16 text-white"
          >
            <path d="M64 0 C 16 25, 16 75, 64 100 L 64 0 Z" fill="currentColor" />
          </svg>
        </div>

        {/* Form */}
        <div className="flex flex-col justify-center p-8 sm:p-10">
          <h1 className="text-2xl font-semibold text-slate-800">Selamat Datang</h1>
          <p className="mt-1 text-sm text-slate-500">
            Masuk untuk mengelola klaim Grab Perkom.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
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

          <p className="mt-6 text-center text-xs text-slate-400">
            Akun internal Perkom · hubungi HR bila belum punya akses
          </p>
        </div>
      </div>
    </div>
  );
}
