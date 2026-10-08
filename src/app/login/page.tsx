"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hero3D } from "@/components/hero-3d";

// Login dua panel ala Cloudflare: kiri branding (3D + logo, desktop saja),
// kanan kartu form. Fungsionalitas login tidak berubah.
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="flex min-h-screen bg-slate-50">
      {/* Panel kiri: branding + 3D (hanya desktop) */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-b from-blue-50/80 via-white to-white p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <Image
            src="/ogoperkom.png"
            alt="Logo Perkom"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            priority
          />
          <span className="text-sm font-semibold text-slate-800">Officeless Perkom</span>
        </div>
        <Hero3D className="h-72 w-full" />
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Klaim Grab Business, tanpa ribet.
          </h2>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-600">
            Satu link WhatsApp untuk karyawan, antrean approval untuk Manager
            dan HR — semuanya tercatat rapi.
          </p>
        </div>
      </div>

      {/* Panel kanan: form */}
      <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-2.5 lg:hidden">
              <Image
                src="/ogoperkom.png"
                alt="Logo Perkom"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
                priority
              />
              <span className="text-sm font-semibold text-slate-800">Officeless Perkom</span>
            </div>
            <h1 className="mt-2 text-xl font-bold text-slate-900 lg:mt-0">
              Masuk ke akun Anda
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Aplikasi internal PT Perkom
            </p>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    className="h-11 rounded-full bg-white pl-11"
                    placeholder="nama@perkom.co.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="h-11 rounded-full bg-white pl-11 pr-11"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              )}

              <Button
                type="submit"
                className="h-11 w-full rounded-full text-base font-semibold"
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Masuk
              </Button>
            </form>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            Akun internal Perkom · butuh akses?{" "}
            <a
              href="mailto:info@perkom.co.id"
              className="font-medium text-slate-500 underline-offset-2 hover:text-blue-700 hover:underline"
            >
              Hubungi HR
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
