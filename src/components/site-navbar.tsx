import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Navbar publik: pill mengambang gaya Apple glassmorphism (blur + saturate).
export function SiteNavbar() {
  return (
    <header className="sticky top-0 z-50 px-4 pt-4">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 rounded-full border border-white/60 bg-white/70 py-2 pl-5 pr-2 shadow-lg shadow-slate-900/5 backdrop-blur-xl backdrop-saturate-150">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/ogoperkom.png"
            alt="Logo Perkom"
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
            priority
          />
          <span className="text-sm font-semibold text-slate-800">
            Officeless Perkom
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          <Link
            href="/docs"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-white/80 hover:text-slate-900"
          >
            Dokumentasi
          </Link>
          <Link
            href="/changelog"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-white/80 hover:text-slate-900"
          >
            Changelog
          </Link>
          <Button asChild className="ml-1 rounded-full">
            <Link href="/login">Masuk</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
