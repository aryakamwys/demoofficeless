import Image from "next/image";
import Link from "next/link";

// Footer publik gaya referensi: latar abu sangat muda, kolom brand/kontak/tautan,
// bar bawah copyright.
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <Image
              src="/ogoperkom.png"
              alt="Logo Perkom"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
            <span className="text-base font-bold text-slate-800">
              Officeless Perkom
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Aplikasi internal PT Perkom untuk pengelolaan klaim Grab Business
            dan layanan operasional karyawan.
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-700">Kontak</h3>
          <div className="mt-3 space-y-1.5 text-sm leading-relaxed text-slate-500">
            <p>E-Mail: info@perkom.co.id</p>
            <p>perkombusiness.com</p>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-700">Tautan</h3>
          <div className="mt-3 flex flex-col items-start gap-1.5">
            <Link
              href="/login"
              className="text-sm text-slate-500 transition-colors hover:text-blue-700"
            >
              Masuk
            </Link>
            <Link
              href="/docs"
              className="text-sm text-slate-500 transition-colors hover:text-blue-700"
            >
              Dokumentasi
            </Link>
            <Link
              href="/changelog"
              className="text-sm text-slate-500 transition-colors hover:text-blue-700"
            >
              Changelog
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <p className="mx-auto max-w-5xl px-4 py-4 text-xs text-slate-400">
          © 2026 PT Perkom. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
