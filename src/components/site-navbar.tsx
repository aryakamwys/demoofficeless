import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Navbar publik: bar penuh menempel atas, glass Apple (blur + saturate).
export function SiteNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/70 backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/ogoperkom.png"
            alt="Logo Perkom"
            width={30}
            height={30}
            className="h-[30px] w-[30px] object-contain"
            priority
          />
          <span className="text-sm font-semibold text-slate-800">
            Officeless Perkom
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          <Link
            href="/docs"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-slate-900"
          >
            Dokumentasi
          </Link>
          <Link
            href="/changelog"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-slate-900"
          >
            Changelog
          </Link>
          <Button asChild className="ml-2 rounded-full">
            <Link href="/login">Masuk</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
