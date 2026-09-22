"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

const NAV = [
  {
    group: "Memulai",
    items: [{ id: "intro", title: "Pengenalan & Login" }],
  },
  {
    group: "Trips",
    items: [
      { id: "employees", title: "Employees" },
      { id: "upload", title: "Upload Statement" },
      { id: "claims", title: "Claims" },
    ],
  },
  {
    group: "Manage Service",
    items: [{ id: "openclaw", title: "Openclaw Ticket" }],
  },
  {
    group: "Inventory",
    items: [{ id: "inventory", title: "Inventory Asset" }],
  },
];

const FLAT = NAV.flatMap((g) => g.items);

function H1({ children }: { children: ReactNode }) {
  return <h1 className="text-2xl font-bold text-slate-900">{children}</h1>;
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 mt-8 text-lg font-bold text-slate-800">{children}</h2>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="my-3 text-sm leading-relaxed text-slate-600">{children}</p>;
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="my-4 space-y-2.5">
      {items.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm text-slate-700">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
            {i + 1}
          </span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="my-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-900">
      {children}
    </div>
  );
}

function Shot({ src, caption }: { src: string; caption: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <figure className="my-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
        <p className="text-sm font-medium text-slate-600">Screenshot belum tersedia</p>
        <p className="mt-1 text-xs text-slate-400">
          Jalankan <code className="rounded bg-slate-100 px-1">node scripts/capture-docs.mjs</code>{" "}
          (dev server jalan) untuk membuat screenshot halaman ini.
        </p>
      </figure>
    );
  }
  return (
    <figure className="my-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={caption} onError={() => setFailed(true)} className="w-full rounded-lg border border-slate-200 shadow-sm" />
      <figcaption className="mt-2 text-xs text-slate-500">{caption}</figcaption>
    </figure>
  );
}

const CONTENT: Record<string, ReactNode> = {
  intro: (
    <>
      <H1>Pengenalan</H1>
      <P>
        Officeless Perkom adalah aplikasi internal untuk mengelola klaim perjalanan Grab Business
        karyawan (modul <b>Trips</b>) serta layanan pendukung operasional: <b>Manage Service</b>{" "}
        (monitoring OpenClaw) dan <b>Inventory</b> (pendataan aset via barcode).
      </P>

      <H2>Struktur Menu</H2>
      <ul className="my-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li><b>Dashboard</b> — ringkasan klaim terbaru.</li>
        <li><b>Trips</b> — Employees (master karyawan), Upload (statement Grab), Claims (klaim & persetujuan).</li>
        <li><b>Manage Service</b> — Openclaw Ticket (monitoring Outlook Perkom).</li>
        <li><b>Inventory</b> — pendaftaran aset Perkom dengan scan barcode.</li>
      </ul>

      <H2>Cara Login</H2>
      <Steps
        items={[
          <>Buka aplikasi, Anda akan diarahkan ke halaman <b>Login</b>.</>,
          <>Masukkan <b>email</b> dan <b>password</b> akun Anda.</>,
          <>Klik tombol <b>Login</b> — Anda masuk ke Dashboard.</>,
        ]}
      />
      <Shot src="/docs/dashboard.png" caption="Halaman Dashboard setelah login" />
    </>
  ),

  employees: (
    <>
      <H1>Employees</H1>
      <P>
        Master data karyawan: NIP, nama, departemen, nomor WhatsApp, role (Employee / Manager / HR),
        atasan (Manager & HR), dan tanda tangan digital. Data ini dipakai oleh modul Upload untuk
        mencocokkan nama pada statement Grab dan oleh modul Claims untuk mengirim notifikasi WhatsApp.
      </P>

      <H2>Mencari Karyawan</H2>
      <P>
        Ketik nama atau NIP pada kolom <b>Cari karyawan...</b> di kiri atas. Hasil tersaring otomatis.
      </P>

      <H2>Menambah Karyawan</H2>
      <Steps
        items={[
          <>Klik tombol <b>Tambah Employee</b>.</>,
          <>Isi form: <b>NIP</b>, <b>Nama</b>, <b>Departemen</b>, <b>Nomor WhatsApp</b>, dan <b>Role</b>.</>,
          <>Pilih <b>Manager</b> dan <b>HR</b> yang akan meng-approve klaim karyawan ini (opsional — bisa juga diatur saat kirim klaim).</>,
          <>Tanda tangan pada area <b>Signature</b>, lalu klik <b>Simpan</b>.</>,
        ]}
      />

      <H2>Import Massal (CSV)</H2>
      <Steps
        items={[
          <>Klik <b>Import CSV</b>.</>,
          <>Siapkan file CSV dengan kolom wajib: <b>employee_number</b>, <b>employee_name</b>, <b>phone_number</b> (kolom <b>department</b> opsional).</>,
          <>Upload file, lalu data masuk otomatis (NIP yang sudah ada akan diperbarui).</>,
        ]}
      />
      <Note>
        Nomor WhatsApp dipakai untuk mengirim notifikasi klaim — pastikan formatnya benar
        (awalan 62, tanpa tanda +). Karyawan dengan nomor yang salah tidak akan menerima pesan.
      </Note>
      <Shot src="/docs/employees.png" caption="Halaman Employees — daftar, pencarian, tambah, import" />
    </>
  ),

  upload: (
    <>
      <H1>Upload Statement</H1>
      <P>
        Unggah file statement perjalanan Grab Business (CSV atau PDF). Sistem otomatis membaca file,
        mengelompokkan perjalanan per karyawan, dan membuat <b>claim</b> untuk masing-masing.
      </P>

      <H2>Langkah Upload</H2>
      <Steps
        items={[
          <>Buka menu <b>Trips → Upload</b>.</>,
          <>Pilih <b>Periode</b> (bulan dan tahun) klaim.</>,
          <>Klik area upload, lalu pilih file statement Grab (format <b>CSV</b> atau <b>PDF</b>).</>,
          <>Klik <b>Upload</b> — file diproses otomatis.</>,
          <>Selesai — sistem menampilkan jumlah <b>claim yang berhasil dibuat</b>.</>,
        ]}
      />

      <H2>Hasil Pemrosesan</H2>
      <ul className="my-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li>Nama pada statement yang <b>cocok</b> dengan master Employees → claim berstatus <b>Pending</b>.</li>
        <li>Nama yang <b>tidak ditemukan</b> → claim berstatus <b>Unmatched</b> (perlu diperbaiki datanya di menu Claims).</li>
      </ul>
      <P>Riwayat upload beserta statusnya tampil di bagian bawah halaman.</P>
      <Shot src="/docs/upload.png" caption="Form Upload Grab Statement & riwayat upload" />
    </>
  ),

  claims: (
    <>
      <H1>Claims</H1>
      <P>
        Daftar klaim perjalanan beserta statusnya. Dari sini admin mengirim notifikasi WhatsApp ke
        karyawan dan memantau alur persetujuan sampai selesai.
      </P>

      <H2>Arti Status</H2>
      <div className="my-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-700">Status</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-700">Arti</th>
            </tr>
          </thead>
          <tbody className="text-slate-600">
            {[
              ["Pending", "Claim baru, belum dikirim ke karyawan."],
              ["Sent", "Notifikasi WhatsApp terkirim, menunggu balasan karyawan."],
              ["Approved", "Disetujui (tahap karyawan / Manager / HR sesuai alur)."],
              ["Need Review", "Karyawan meminta koreksi data."],
              ["Unmatched", "Nama pada statement tidak cocok dengan master Employees — perlu diperbaiki."],
            ].map(([s, d]) => (
              <tr key={s}>
                <td className="border-b border-slate-100 px-3 py-2 font-semibold text-slate-700">{s}</td>
                <td className="border-b border-slate-100 px-3 py-2">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Mengirim Notifikasi WhatsApp</H2>
      <Steps
        items={[
          <>Klik claim yang ingin dikirim (atau tombol kirim pada barisnya).</>,
          <>Pilih <b>Manager (Approver 1)</b> dan <b>HR (Approver 2)</b> — bisa dibiarkan kosong untuk auto-bypass.</>,
          <>Klik <b>Kirim WhatsApp</b> — karyawan menerima rincian perjalanan + total biaya.</>,
          <>Karyawan membalas langsung di WhatsApp: <b>1</b> = Setuju, <b>2</b> = Koreksi, <b>3</b> = Detail.</>,
          <>Jika setuju, persetujuan berlanjut otomatis ke <b>Manager</b>, lalu <b>HR</b>, juga via WhatsApp.</>,
        ]}
      />
      <Note>
        Jika pengiriman gagal karena rate limit WhatsApp (terlalu banyak pesan beruntun), tunggu
        beberapa menit lalu kirim ulang. Beri jeda antar pengiriman jika mengirim banyak klaim sekaligus.
      </Note>
      <Shot src="/docs/claims.png" caption="Daftar Claims beserta statusnya" />
    </>
  ),

  openclaw: (
    <>
      <H1>Openclaw Ticket</H1>
      <P>
        Halaman monitoring otomatisasi <b>Outlook Perkom</b>: email masuk ke inbox Perkom dipantau
        OpenClaw, diekstraksi, lalu dibuatkan ticket secara otomatis (rata-rata ± 3 menit per ticket).
      </P>

      <H2>Cara Membaca Halaman</H2>
      <ul className="my-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li><b>Banner monitoring</b> — status sedang memantau inbox + progres alur: Memantau inbox → Ekstraksi email → Pembuatan ticket.</li>
        <li><b>Tabel Ticket</b> — daftar ticket terbaru: nomor ticket, subjek, pengirim, kategori, waktu jadi, dan pembaruan terakhir.</li>
        <li>Tombol <b>Refresh</b> mengambil data terbaru dari service desk.</li>
      </ul>
      <Shot src="/docs/openclaw.png" caption="Monitoring Outlook Perkom & daftar ticket" />
    </>
  ),

  inventory: (
    <>
      <H1>Inventory Asset</H1>
      <P>
        Pendataan aset Perkom dengan <b>scan barcode</b> — laptop, desktop, printer, dan aset lain
        didaftarkan lewat kamera sehingga mapping aset jadi cepat dan tidak ada salah ketik.
      </P>

      <H2>Mendaftarkan Aset</H2>
      <Steps
        items={[
          <>Buka menu <b>Inventory</b>.</>,
          <>Klik <b>Mulai Scan</b>, lalu izinkan akses kamera di browser.</>,
          <>Arahkan kamera ke <b>barcode</b> aset — barcode terbaca otomatis dan masuk ke daftar.</>,
          <>Isi <b>Nama Asset</b> (mis. “Laptop Lenovo M70q”) dan <b>Lokasi</b> (mis. “Office Jakarta”).</>,
          <>Lanjutkan scan aset berikutnya — semua hasil masuk ke daftar yang sama.</>,
          <>Klik <b>Simpan Semua</b> untuk menyimpan ke database.</>,
        ]}
      />

      <H2>Input Manual</H2>
      <P>
        Jika barcode rusak atau kamera tidak tersedia, ketik nomor barcode pada kolom manual lalu
        tekan Enter.
      </P>
      <Note>
        <b>Penting:</b> akses kamera hanya diizinkan browser pada alamat <b>HTTPS</b> atau{" "}
        <b>localhost</b>. Menggunakan aset yang sudah terdaftar? Scan ulang barcode yang sama akan{" "}
        <b>memperbarui</b> data (bukan menduplikat).
      </Note>
      <Shot src="/docs/inventory.png" caption="Scanner barcode, hasil scan, dan aset terdaftar" />
    </>
  ),
};

export default function DocsPage() {
  const [active, setActive] = useState("intro");
  const idx = FLAT.findIndex((i) => i.id === active);
  const prev = FLAT[idx - 1];
  const next = FLAT[idx + 1];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Image src="/ogoperkom.png" alt="Perkom" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="text-sm font-bold text-slate-800">Dokumentasi Officeless Perkom</span>
          <Link href="/dashboard" className="ml-auto text-xs font-semibold text-blue-600 hover:underline">
            Buka Aplikasi →
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8">
        <aside className="sticky top-20 hidden h-fit w-56 shrink-0 lg:block">
          {NAV.map((g) => (
            <div key={g.group} className="mb-5">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {g.group}
              </p>
              {g.items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setActive(it.id)}
                  className={cn(
                    "mb-0.5 block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors",
                    active === it.id
                      ? "bg-blue-50 font-semibold text-blue-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  {it.title}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <main className="min-w-0 flex-1">
          {/* Navigasi mobile */}
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden">
            {FLAT.map((it) => (
              <button
                key={it.id}
                onClick={() => setActive(it.id)}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium",
                  active === it.id ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                )}
              >
                {it.title}
              </button>
            ))}
          </div>

          <article className="rounded-xl border border-slate-200 bg-white p-6 sm:p-10">
            {CONTENT[active]}
          </article>

          <div className="mt-6 flex items-center justify-between">
            {prev ? (
              <button
                onClick={() => setActive(prev.id)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-left text-sm text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700"
              >
                ← {prev.title}
              </button>
            ) : (
              <span />
            )}
            {next ? (
              <button
                onClick={() => setActive(next.id)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-right text-sm text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700"
              >
                {next.title} →
              </button>
            ) : (
              <span />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
