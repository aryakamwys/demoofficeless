"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  {
    group: "Memulai",
    items: [{ id: "intro", title: "Pengenalan & Login" }],
  },
  {
    group: "Alur WhatsApp",
    items: [
      { id: "wa-flow", title: "Diagram Alur & Data" },
      { id: "wa-karyawan", title: "Panduan Karyawan" },
      { id: "wa-approver", title: "Panduan Manager & HR" },
    ],
  },
  {
    group: "Claims Grab",
    items: [
      { id: "employees", title: "Employees" },
      { id: "upload", title: "Upload Statement" },
      { id: "claims", title: "Claims" },
      { id: "trip-ticket", title: "Ticket EnvGate per Trip" },
      { id: "report", title: "Report PDF" },
    ],
  },
  {
    group: "Manage Service",
    items: [
      { id: "openclaw", title: "Openclaw Ticket" },
      { id: "envgate", title: "EnvGate Test" },
    ],
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

/** Chip perintah, mis. UBAH 3 75000 */
function Cmd({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-blue-700">
      {children}
    </code>
  );
}

/** Mock chat WhatsApp — bot di kiri (putih), balasan Anda di kanan (hijau). */
function Chat({
  title,
  messages,
}: {
  title: string;
  messages: Array<{ from: "bot" | "user"; text: string }>;
}) {
  return (
    <figure className="my-5 rounded-xl border border-slate-200 bg-[#ece5dd] p-3">
      <figcaption className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </figcaption>
      <div className="space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[88%] whitespace-pre-line rounded-xl px-3 py-2 text-[12px] leading-snug text-slate-800 shadow-sm",
                m.from === "user" ? "rounded-br-sm bg-[#d9fdd3]" : "rounded-bl-sm bg-white"
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
    </figure>
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

/** Diagram alur/state — teks ASCII monospace, bisa digeser di layar kecil. */
function Diagram({ caption, children }: { caption: string; children: string }) {
  return (
    <figure className="my-5">
      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-4">
        <pre className="font-mono text-[11px] leading-relaxed text-slate-100">{children}</pre>
      </div>
      <figcaption className="mt-2 text-xs text-slate-500">{caption}</figcaption>
    </figure>
  );
}

/** Kartu entitas untuk ERD — nama tabel + field penting beserta keterangannya. */
function Entity({ name, rows }: { name: string; rows: Array<[string, string]> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-300">
      <div className="bg-slate-100 px-3 py-1.5 font-mono text-xs font-bold text-slate-700">{name}</div>
      <dl className="divide-y divide-slate-100 bg-white">
        {rows.map(([f, d]) => (
          <div key={f} className="flex justify-between gap-3 px-3 py-1.5">
            <dt className="shrink-0 font-mono text-[11px] font-semibold text-slate-800">{f}</dt>
            <dd className="text-right text-[11px] leading-snug text-slate-500">{d}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const CONTENT: Record<string, ReactNode> = {
  intro: (
    <>
      <H1>Pengenalan</H1>
      <P>
        Officeless Perkom adalah aplikasi internal untuk mengelola klaim perjalanan Grab Business
        karyawan (modul <b>Claims Grab</b>) serta layanan pendukung operasional: <b>Manage Service</b>{" "}
        (monitoring OpenClaw) dan <b>Inventory</b> (pendataan aset via barcode).
      </P>

      <H2>Struktur Menu</H2>
      <ul className="my-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li><b>Dashboard</b> — ringkasan klaim (kartu statistik).</li>
        <li><b>Claims Grab</b> — Employees (master karyawan), Upload (statement Grab), Claims (klaim & persetujuan).</li>
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
      <Shot src="/docs/dashboard.png?v=2" caption="Halaman Dashboard setelah login" />
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
          <>Buka menu <b>Claims Grab → Upload</b>.</>,
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
          <>Karyawan membalas langsung di WhatsApp: <b>1</b> = Setuju, <b>2</b> = Ada yang salah, <b>3</b> = Lihat detail — lihat <b>Panduan Karyawan</b>.</>,
          <>Jika setuju, persetujuan berlanjut otomatis ke <b>Manager</b>, lalu <b>HR</b>, juga via WhatsApp.</>,
        ]}
      />
      <Note>
        Jika pengiriman gagal karena rate limit WhatsApp (terlalu banyak pesan beruntun), tunggu
        beberapa menit lalu kirim ulang. Beri jeda antar pengiriman jika mengirim banyak klaim sekaligus.
      </Note>

      <H2>Membatalkan Approval</H2>
      <P>
        Ada kesalahan setelah klaim di-approve? Di halaman detail klaim yang berstatus{" "}
        <b>Approved</b>, klik tombol <b>Batalkan Approval</b>. Klaim dikembalikan ke menunggu
        konfirmasi karyawan (balas 1 di WhatsApp), status approval Manager &amp; HR direset — data
        trip dan ticket tidak berubah. Pembatalan tercatat sebagai note pada klaim.
      </P>
      <Shot src="/docs/claims.png?v=2" caption="Daftar Claims beserta statusnya" />
    </>
  ),

  "wa-flow": (
    <>
      <H1>Diagram Alur WhatsApp &amp; Struktur Data</H1>
      <P>
        Semua persetujuan klaim lewat satu bot WhatsApp. Identitas pengirim adalah
        <b> nomor WhatsApp</b> yang terdaftar di data karyawan — bot mencocokkannya dengan klaim
        yang sedang berjalan. Ada dua cara memberi keputusan: <b>balas chat</b> (angka/perintah)
        atau <b>ketuk link</b> di pesan lalu tekan tombolnya — keduanya menjalani pemeriksaan yang sama.
      </P>

      <H2>Peta Alur Klaim</H2>
      <Diagram caption="Alur persetujuan: karyawan → manager → HR, dengan mode revisi yang bisa berulang.">{`
                    ┌─────────────────────────────────────────────┐
                    │                MODE REVISI                 │
                    │    karyawan mengerjakan via chat / tombol:  │
                    │    LIST          daftar trip bernomor      │
                    │    UBAH 3 x      ubah nominal trip 3       │
                    │    HAPUS 3 x     hapus trip 3 + alasan     │
                    │    TICKET 3 x    lampirkan ticket EnvGate  │
                    │    SUDAH TF      penggantian sudah dibayar │
                    │    SELESAI       kirim ulang ke approver   │
                    └──────▲────────────────────────────▲────────┘
                           │ "2 <alasan>"               │ "2 <alasan>"
                           │                            │
 ┌───────────┐  "1"  ┌───────────┐  "1"   ┌───────────┐ "1"  ┌────────────────┐
 │ KARYAWAN  │──────►│  MANAGER  │───────►│    HR     │─────►│ APPROVED       │
 │ cek data  │       │ cek klaim │        │ cek akhir │      │ klaim selesai, │
 └───────────┘       └───────────┘        └───────────┘      │ kabar ke       │
   │"2" catatan       │ chat aneh →        │ chat aneh →     │ karyawan       │
   │"3" detail        │ menu bantuan       │ menu bantuan    └────────────────┘
   │teks = catatan
`}</Diagram>
      <P>
        Balasan <Cmd>SELESAI</Cmd> mengembalikan klaim ke approver yang meminta revisi
        (Manager atau HR) — bisa berulang sampai semua setuju. Chat yang tidak dikenali
        selalu dibalas menu bantuan, tidak pernah dibiarkan diam.
      </P>

      <H2>Alur Penggantian Trip Tidak Sesuai</H2>
      <P>
        Trip yang ditandai HR (misalnya arah pulang di jam kantor) tidak langsung hilang —
        biayanya diganti karyawan ke rekening kantor, dan trip keluar dari klaim setelah
        pembayaran dikonfirmasi.
      </P>
      <Diagram caption="State penggantian (tabel trip_refunds): REQUESTED → CLAIMED → CONFIRMED, plus jalur batal.">{`
    HR menandai trip "tidak sesuai" di web
    (alasan + nominal + rekening kantor dikirim ke WA karyawan)
                      │
                      ▼
         ┌────────────────────┐    SUDAH TF    ┌────────────────────┐
         │     REQUESTED      │ ─────────────► │      CLAIMED       │
         │  menunggu transfer │                │ karyawan bilang    │
         │                    │ ◄───────────── │ sudah transfer     │
         └────────────────────┘  BELUM TF /    │ (menunggu HR cek   │
              │                HR: belum masuk │  mutasi rekening)  │
              │ HR: batalkan                   └─────────┬──────────┘
              ▼                                          │ HR: "Pembayaran
         ┌────────────────────┐                          ▼    diterima" (web)
         │     CANCELLED      │                ┌────────────────────┐
         │ trip tetap di      │                │     CONFIRMED      │
         │ klaim, tidak perlu │                │ trip keluar klaim, │
         │ diganti            │                │ total dihitung     │
         └────────────────────┘                │ ulang otomatis     │
                                               └────────────────────┘

    Selama ada REQUESTED / CLAIMED: klaim DITAHAN —
    "1", SELESAI, dan approve manual ditolak sampai penggantian beres.
`}</Diagram>

      <H2>Struktur Data (ERD)</H2>
      <P>
        Tujuh tabel yang dipakai alur klaim &amp; WhatsApp. Panah relasi ada di daftar
        di bawah kartu.
      </P>
      <div className="my-4 grid gap-3 sm:grid-cols-2">
        <Entity
          name="employees"
          rows={[
            ["id", "identitas karyawan"],
            ["employee_name", "dipakai cocokkan nama di statement Grab"],
            ["department", "departemen"],
            ["phone_number", "nomor WhatsApp — kunci pengenalan bot"],
            ["manager_id →", "atasan (menunjuk employees lagi)"],
            ["hr_id →", "HR (menunjuk employees lagi)"],
          ]}
        />
        <Entity
          name="claims"
          rows={[
            ["employee_id →", "pemilik klaim"],
            ["manager_id → / hr_id →", "dua pemberi persetujuan"],
            ["period", "periode tagihan, mis. Agustus 2026"],
            ["status", "PENDING / SENT / NEED_REVIEW / APPROVED"],
            ["approved_at", "waktu karyawan tekan SETUJU"],
            ["manager_status · hr_status", "PENDING / APPROVED per tahap"],
            ["total_amount · trip_count", "ikut dihitung ulang tiap perubahan"],
            ["pending_wa_change", "konfirmasi UBAH/HAPUS yang menunggu YA"],
            ["ticket_wizard", "progres mode isi ticket satu-per-satu"],
          ]}
        />
        <Entity
          name="trips"
          rows={[
            ["claim_id →", "klaim induk"],
            ["trip_date", "tanggal + jam perjalanan"],
            ["pickup · dropoff", "titik jemput / tujuan"],
            ["fare", "biaya perjalanan"],
            ["ticket_id", "bukti ticket EnvGate (opsional)"],
          ]}
        />
        <Entity
          name="trip_refunds"
          rows={[
            ["claim_id → · trip_id →", "trip_id jadi NULL setelah trip dihapus"],
            ["trip_no · trip_date · …", "snapshot trip — riwayat tetap hidup"],
            ["amount · reason", "nominal penggantian + alasan penandaan"],
            ["status", "REQUESTED / CLAIMED / CONFIRMED / CANCELLED"],
            ["employee_note", "keterangan karyawan, mis. bca jam 14.30"],
            ["requested_by/at · claimed_at", "jejak siapa-kapan"],
            ["confirmed_by/at · cancelled_at", "keputusan HR"],
          ]}
        />
        <Entity
          name="comments"
          rows={[
            ["claim_id →", "timeline klaim"],
            ["message", "isi catatan / keputusan"],
            ["author_name · author_role", "EMPLOYEE / MANAGER / HR / SYSTEM"],
            ["created_at", "urutan kejadian"],
          ]}
        />
        <Entity
          name="whatsapp_logs"
          rows={[
            ["claim_id → (boleh NULL)", "jejak setiap pesan masuk/keluar"],
            ["phone_number", "nomor pengirim/penerima"],
            ["message_type", "label jenis pesan, mis. MANAGER_APPROVAL_PROMPT"],
            ["status", "SENT / FAILED / RECEIVED"],
            ["response", "cuplikan isi / pesan error"],
          ]}
        />
        <Entity
          name="app_settings"
          rows={[
            ["key", "mis. company_bank_name"],
            ["value", "mis. BCA"],
            ["", "rekening kantor tujuan penggantian — berdiri sendiri, tidak berelasi"],
          ]}
        />
      </div>
      <div className="my-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-700">Relasi</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-700">Arti</th>
            </tr>
          </thead>
          <tbody className="text-slate-600">
            {[
              ["employees 1 ─ N claims", "satu karyawan bisa punya banyak klaim; manager_id dan hr_id menunjuk karyawan lain sebagai pemberi persetujuan"],
              ["employees.manager_id / hr_id ─ employees", "struktur atasan menunjuk dirinya sendiri (self-reference)"],
              ["claims 1 ─ N trips", "satu klaim berisi banyak perjalanan"],
              ["claims 1 ─ N trip_refunds", "penggantian tercatat per klaim"],
              ["trips 1 ─ 0..1 trip_refunds", "satu trip maksimal satu penggantian aktif; trip dihapus saat CONFIRMED tapi snapshot-nya tetap"],
              ["claims 1 ─ N comments", "semua catatan & keputusan jadi timeline"],
              ["claims 1 ─ N whatsapp_logs", "audit tiap pesan; boleh NULL untuk pesan di luar klaim"],
            ].map(([r, d]) => (
              <tr key={r}>
                <td className="border-b border-slate-100 px-3 py-2 font-mono text-[11px] font-semibold text-slate-700">{r}</td>
                <td className="border-b border-slate-100 px-3 py-2">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Note>
        <b>Kenapa aman:</b> nomor WhatsApp adalah identitas — pesan dari nomor asing tidak
        dikenali. Link tombol di pesan bertanda tangan rahasia dan hangus 7 hari; peran
        dan tahap klaim dicek ulang setiap aksi. Semua keputusan tercatat di
        <span className="font-mono text-[11px]"> comments</span> dan
        <span className="font-mono text-[11px]"> whatsapp_logs</span> — siapa, kapan, apa.
      </Note>
    </>
  ),

  "wa-karyawan": (
    <>
      <H1>Panduan Karyawan (WhatsApp)</H1>
      <P>
        Setiap periode, sistem mengirim ringkasan klaim Grab Anda lewat WhatsApp. Anda tidak perlu
        buka aplikasi apa pun — <b>cukup balas pesannya dengan angka</b>. Panduan ini menunjukkan
        percakapan aslinya langkah demi langkah.
      </P>

      <H2>1. Menerima Ringkasan Klaim</H2>
      <P>
        Bot mengirim rangkuman perjalanan + total biaya. Baca dulu, lalu balas dengan salah satu
        angka ini:
      </P>
      <div className="my-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-700">Balas</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-700">Arti</th>
            </tr>
          </thead>
          <tbody className="text-slate-600">
            {[
              ["1", "SETUJU — semua data benar, langsung diteruskan ke Manager Anda."],
              ["2", "ADA YANG SALAH — Anda akan ditanya apa masalahnya."],
              ["3", "LIHAT DETAIL — melihat alamat lengkap tiap perjalanan."],
            ].map(([s, d]) => (
              <tr key={s}>
                <td className="border-b border-slate-100 px-3 py-2 text-center font-mono text-base font-bold text-blue-700">{s}</td>
                <td className="border-b border-slate-100 px-3 py-2">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>2. Contoh: Semua Data Benar</H2>
      <Chat
        title="Contoh percakapan — SETUJU"
        messages={[
          {
            from: "bot",
            text: "Halo Mario,\n\nIni rangkuman klaim Grab Business Anda periode Agustus 2026. Mohon dicek dulu sebelum disetujui:\n\n- 02 Jul: Menara Karya Main Lobb... -> MID Plaza (Rp40.500)\n- 10 Jul: Palmerah Motorcycle St... -> MID Plaza 1 Main Lobby (Rp61.000)\n\nJumlah perjalanan: 3\nTotal biaya: Rp137.500\n\nCARA MEMBALAS (ketik nomornya saja):\n1 = SETUJU - semua data benar, langsung diteruskan ke Manager\n2 = ADA YANG SALAH - ceritakan apa yang salah\n3 = LIHAT DETAIL - alamat lengkap tiap perjalanan",
          },
          { from: "user", text: "1" },
          {
            from: "bot",
            text: "TERIMA KASIH. Data klaim Anda sudah SETUJU.\n\nSekarang menunggu persetujuan Manager Anda (Rini).\n\nAnda tidak perlu membalas pesan ini lagi.",
          },
        ]}
      />

      <H2>3. Contoh: Ada yang Salah</H2>
      <P>
        Ketik <b>2</b>, lalu tulis masalahnya dalam satu pesan. Tulisan Anda menjadi catatan untuk
        HR. Setelah yakin benar, tetap akhiri dengan <b>1</b> (SETUJU).
      </P>
      <Chat
        title="Contoh percakapan — KOREKSI"
        messages={[
          { from: "user", text: "2" },
          {
            from: "bot",
            text: "Baik, ada yang salah. Tolong tulis masalahnya dalam SATU pesan saja.\n\nContoh balasan:\n- trip 10 Juli bukan perjalanan saya\n- nominal trip no 2 seharusnya Rp50.000\n\nTulisan Anda akan menjadi catatan untuk HR.",
          },
          { from: "user", text: "trip 10 Juli bukan perjalanan saya, itu teman saya yang pinjam akun" },
          {
            from: "bot",
            text: 'SUDAH TERSIMPAN. Catatan Anda:\n"trip 10 Juli bukan perjalanan saya, itu teman saya yang pinjam akun"\n\nBalas 1 = SETUJU, 3 = lihat detail,\natau tulis catatan lain.',
          },
          { from: "user", text: "1" },
        ]}
      />

      <H2>4. Contoh: Diminta Revisi oleh Manager / HR</H2>
      <P>
        Kalau Manager atau HR meminta revisi, Anda bisa mengubah nominal sendiri lewat chat —
        tanpa buka laptop. Tiga perintahnya:
      </P>
      <ul className="my-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li><Cmd>LIST</Cmd> — lihat daftar trip bernomor (lengkap dengan jam).</li>
        <li><Cmd>UBAH 3 75000</Cmd> — ubah trip no 3 jadi Rp75.000 (contoh).</li>
        <li><Cmd>HAPUS 3 pulang ke rumah di jam kantor</Cmd> — hapus trip yang tidak boleh diklaim (dengan alasan, ada konfirmasi YA).</li>
        <li><Cmd>TICKET 3 PIM-34285</Cmd> — lampirkan bukti ticket EnvGate ke trip no 3.</li>
        <li><Cmd>TICKET SEMUA</Cmd> — isi ticket semua trip, dipandu satu per satu.</li>
        <li><Cmd>SELESAI</Cmd> — sudah selesai, kirim ulang ke approver.</li>
      </ul>

      <H2>4a. Trip ditandai &quot;tidak sesuai&quot; — ganti ke rekening kantor</H2>
      <P>
        Kalau HR menandai ada trip yang tidak sesuai (misalnya arah pulang di jam kantor),
        biaya trip itu diganti karyawan ke rekening kantor. Nominal dan rekening dikirim
        lewat WhatsApp. Selama penggantian belum selesai, klaim ditahan — tidak bisa
        disetujui atau dikirim ulang.
      </P>
      <ul className="my-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li><Cmd>SUDAH TF</Cmd> — nyatakan sudah transfer (boleh ditambah keterangan: <Cmd>SUDAH TF bca jam 14.30</Cmd>). HR mencocokkan mutasi rekening.</li>
        <li><Cmd>BELUM TF</Cmd> — batalkan kalau salah kirim &quot;sudah transfer&quot;.</li>
        <li><Cmd>NOREK</Cmd> — minta ulang nominal &amp; rekening kantor.</li>
      </ul>
      <P>
        Setelah HR menekan <b>Pembayaran Diterima</b> di halaman klaim, trip itu keluar
        dari klaim otomatis dan total dihitung ulang. Trip bertanda tidak sesuai tidak
        bisa dihapus sendiri lewat <Cmd>HAPUS</Cmd> — harus lewat penggantian ini.
      </P>
      <Chat
        title="Contoh percakapan — REVISI"
        messages={[
          {
            from: "bot",
            text: "Halo Mario,\n\nKlaim periode Agustus 2026 DIMINTA REVISI oleh Manager (Rini).\nAlasan: nominal trip 3 masih kurang tepat\n\nCARA REVISI LEWAT WHATSAPP INI (langkah demi langkah):\n1. Ketik LIST - untuk melihat daftar trip bernomor\n2. Ketik UBAH <nomor trip> <nominal baru> - contoh: UBAH 3 75000\n3. Ketik TICKET <nomor trip> <id ticket> - contoh: TICKET 3 PIM-34285\n4. Ketik SELESAI - klaim dikirim ulang ke Manager",
          },
          { from: "user", text: "list" },
          {
            from: "bot",
            text: "Daftar Trip klaim periode Agustus 2026:\n1. 02 Jul: Menara Karya ... -> MID Plaza (Rp40.500)\n2. 02 Jul: MID Plaza ... -> Menara Karya (Rp36.000)\n3. 10 Jul: Palmerah ... -> MID Plaza 1 (Rp61.000)\n\nTotal: Rp137.500",
          },
          { from: "user", text: "UBAH 3 75000" },
          {
            from: "bot",
            text: "KONFIRMASI UBAH NOMINAL - trip no 3\n10 Jul: Palmerah ... -> MID Plaza 1\nNominal sekarang: Rp61.000\nNominal baru: Rp75.000\n\nBalas YA untuk SIMPAN, atau BATAL untuk membatalkan.",
          },
          { from: "user", text: "YA" },
          {
            from: "bot",
            text: "SUDAH TERSIMPAN. Trip no 3 berubah dari Rp61.000 jadi Rp75.000.\nTotal klaim sekarang: Rp151.500\n\nSudah selesai? Ketik SELESAI.",
          },
          { from: "user", text: "SELESAI" },
          {
            from: "bot",
            text: "SELESAI. Revisi Anda sudah dikirim ulang ke Manager untuk disetujui.\nAnda akan dikabari lagi setelah ada hasilnya.",
          },
        ]}
      />

      <H2>5. Melampirkan Ticket EnvGate (Bukti Kerja)</H2>
      <P>
        Setiap trip bisa dilengkapi nomor ticket EnvGate sebagai bukti pekerjaan — cukup diketik di
        chat, kapan saja (saat konfirmasi awal maupun saat revisi). Tiket yang sudah terpasang
        tampil sebagai <b>[#PIM-34285]</b> di samping baris trip, dan otomatis muncul lengkap di
        Report PDF.
      </P>
      <Chat
        title="Contoh percakapan — melampirkan ticket"
        messages={[
          { from: "user", text: "TICKET 3 PIM-34285" },
          {
            from: "bot",
            text: "SUDAH TERSIMPAN. Trip no 3 kini punya bukti ticket #PIM-34285.\nJudul ticket: Keyboard T14 (Cocacola - Cust. Perkom)\n\n5 dari 8 trip sudah punya ticket — sisa 3 belum.\nLanjut isi sisanya satu per satu? Ketik: TICKET SEMUA\n\nBalas 1 = SETUJU kalau semua data sudah benar.",
          },
        ]}
      />
      <P>
        Kalau klaim hanya punya satu trip, cukup kirim nomor ticket-nya saja: <Cmd>#PIM-34285</Cmd>.
        Kalau trip-nya banyak, bot akan menanyakan trip yang mana.
      </P>
      <Note>
        <b>Nomor ticket diverifikasi ke EnvGate.</b> Kalau nomornya tidak ada di EnvGate, bot
        menolak dan meminta dikoreksi — jadi data yang sampai ke HR pasti ticket yang benar-benar
        ada.
      </Note>

      <H2>6. Banyak Ticket Sekaligus: <Cmd>TICKET SEMUA</Cmd></H2>
      <P>
        Kalau satu bulan ada banyak trip dan banyak ticket, ketik <Cmd>TICKET SEMUA</Cmd>. Bot
        memandu <b>satu trip per satu</b> — tampilkan detail trip, Anda kirim nomor ticket-nya,
        lanjut ke trip berikutnya. Sulit tertukar karena tidak perlu mengingat nomor trip.
      </P>
      <Chat
        title="Contoh percakapan — mode TICKET SEMUA"
        messages={[
          { from: "user", text: "TICKET SEMUA" },
          {
            from: "bot",
            text: "MODE NGISI TICKET — sisa 3 trip lagi.\nKita isi SATU PER SATU supaya tidak tertukar.\n\nTrip 2 (28 Jul: Jl. Jend. Sudirman Kav.10-11... -> MID Plaza 2 ...)\nKirim nomor ticket untuk trip ini. Contoh: PIM-34285\n\nKetik LEWATI kalau trip ini tidak punya ticket.\nKetik BATAL kalau mau berhenti dulu.",
          },
          { from: "user", text: "PIM-34285" },
          {
            from: "bot",
            text: "SUDAH TERSIMPAN. Trip no 2 → #PIM-34285.\nJudul: Keyboard T14 (Cocacola - Cust. Perkom)\n\nMODE NGISI TICKET — sisa 2 trip lagi.\n\nTrip 4 (30 Jul: Palmerah ... -> MID Plaza 1 ...)\nKirim nomor ticket untuk trip ini. Contoh: PIM-34285\n\nKetik LEWATI kalau trip ini tidak punya ticket.\nKetik BATAL kalau mau berhenti dulu.",
          },
          { from: "user", text: "LEWATI" },
        ]}
      />
      <ul className="my-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li>Cukup kirim nomor ticket saja (mis. <Cmd>PIM-34285</Cmd>) — bot tahu trip yang dimaksud.</li>
        <li><Cmd>LEWATI</Cmd> — trip ini tidak punya ticket, lanjut ke berikutnya.</li>
        <li><Cmd>BATAL</Cmd> — berhenti dulu; kapan saja lanjut lagi dengan <Cmd>TICKET SEMUA</Cmd>.</li>
      </ul>

      <H2>Hal yang Perlu Diketahui</H2>
      <ul className="my-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li><b>Tidak mau mengetik?</b> Pesan klaim menyertakan <b>tautan</b> — ketuk tautannya, lalu tekan tombol <b>SETUJU</b> atau <b>ADA YANG SALAH</b> di halaman yang terbuka. Tanpa login, tanpa mengetik angka.</li>
        <li>Huruf besar atau kecil sama saja — <Cmd>list</Cmd> = <Cmd>LIST</Cmd>.</li>
        <li>Satu pesan = satu perintah. Jangan gabung dua perintah dalam satu balasan.</li>
        <li>Bot menjawab agak lambat (3–7 detik) — itu <b>disengaja</b> agar nomor pengirim aman dari pembatasan WhatsApp. Tunggu saja, jangan kirim ulang.</li>
        <li>Balasan singkat seperti “eh” atau “?” akan dibalas menu bantuan — tidak jadi catatan.</li>
      </ul>
    </>
  ),

  "wa-approver": (
    <>
      <H1>Panduan Manager &amp; HR (WhatsApp)</H1>
      <P>
        Setelah karyawan menyetujui klaimnya, Anda menerima pesan berisi rincian klaim. Cukup balas
        dengan angka — tidak perlu buka aplikasi.
      </P>

      <H2>Menu Keputusan</H2>
      <div className="my-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-700">Balas</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-700">Arti</th>
            </tr>
          </thead>
          <tbody className="text-slate-600">
            {[
              ["1", "SETUJU — klaim diteruskan ke HR (Manager) / selesai disetujui (HR)."],
              ["2 <alasan>", "MINTA REVISI — klaim kembali ke karyawan beserta alasan Anda."],
            ].map(([s, d]) => (
              <tr key={s}>
                <td className="border-b border-slate-100 px-3 py-2 font-mono font-bold text-blue-700">{s}</td>
                <td className="border-b border-slate-100 px-3 py-2">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Contoh: Menyetujui</H2>
      <Chat
        title="Contoh percakapan — Manager menyetujui"
        messages={[
          {
            from: "bot",
            text: "Halo Manager,\n\nMario mengajukan klaim Grab periode Agustus 2026.\nKaryawan tersebut SUDAH mengecek dan menyetujui datanya sendiri.\n\n- 02 Jul: Menara Karya ... -> MID Plaza (Rp40.500)\n- 10 Jul: Palmerah ... -> MID Plaza 1 (Rp61.000)\n\nJumlah perjalanan: 3\nTotal biaya: Rp137.500\n\nKEPUTUSAN ANDA (ketik nomornya):\n1 = SETUJU - klaim diteruskan ke HR\n2 = MINTA REVISI - ketik 2 lalu tulis alasannya\n   Contoh: 2 nominal trip 3 masih kurang tepat",
          },
          { from: "user", text: "1" },
          {
            from: "bot",
            text: "TERIMA KASIH. Klaim atas nama Mario sudah Anda SETUJUI.\nKlaim diteruskan ke HR untuk persetujuan terakhir.",
          },
        ]}
      />

      <H2>Contoh: Minta Revisi</H2>
      <P>
        Ketik <b>2</b> <i>langsung diikuti alasan</i> dalam pesan yang sama. Alasan ini diteruskan
        ke karyawan supaya tahu apa yang harus diperbaiki.
      </P>
      <Chat
        title="Contoh percakapan — Manager meminta revisi"
        messages={[
          { from: "user", text: "2 nominal trip 3 masih kurang tepat, tolong cek ulang" },
          {
            from: "bot",
            text: "TERIMA KASIH. Permintaan revisi sudah dicatat\ndan diteruskan ke Mario lewat WhatsApp.\n\nAlasan revisi: nominal trip 3 masih kurang tepat, tolong cek ulang",
          },
        ]}
      />
      <P>
        Karyawan lalu merevisi sendiri lewat chat (lihat <b>Panduan Karyawan</b>) — mengubah nominal
        dengan <Cmd>UBAH</Cmd>, menghapus trip yang tidak boleh diklaim dengan <Cmd>HAPUS</Cmd>,
        lalu <Cmd>SELESAI</Cmd>. Setelah itu Anda menerima lagi pesan klaimnya untuk keputusan
        berikutnya. Alur ini bisa berulang sampai Anda setuju.
      </P>

      <H2>Trip yang Mencurigakan (contoh: pulang ke rumah di jam kerja)</H2>
      <P>
        Kalau ada trip yang bukan hak klaim — misalnya rute <b>pulang ke rumah</b> pada jam
        kerja — minta klarifikasi lewat <b>2 + alasan</b>, contoh:{" "}
        <Cmd>2 trip 5 rutenya pulang ke rumah dan jamnya masih kerja, mohon klarifikasi</Cmd>.
        Daftar trip di pesan menampilkan <b>jam</b> perjalanan supaya mudah dinilai.
      </P>
      <P>
        Kalau memang tidak seharusnya diklaim, karyawan menghapusnya sendiri dengan{" "}
        <Cmd>HAPUS 5 &lt;alasan&gt;</Cmd> — trip keluar dari klaim, total biaya dihitung ulang,
        dan alasannya tercatat sebagai note untuk audit. Klaim dengan trip yang sudah dihapus
        tetap tampil rapi di Report PDF.
      </P>

      <H2>Cara Paling Mudah: Tombol</H2>
      <P>
        Pesan persetujuan menyertakan <b>tautan</b> — ketuk tautannya dan halaman keputusan
        terbuka (tanpa login): ringkasan klaim + tombol <b>✓ SETUJU</b> dan <b>✎ Minta revisi</b>
        (revisi meminta alasan). Logikanya sama dengan membalas 1/2 di chat, tinggal pilih
        yang paling nyaman.
      </P>

      <H2>Urutan Persetujuan</H2>
      <Steps
        items={[
          <>Karyawan mengecek dan menyetujui datanya sendiri (balas 1).</>,
          <>Manager menyetujui (balas 1) — atau meminta revisi (balas 2 + alasan).</>,
          <>HR memberi persetujuan terakhir (balas 1) — klaim selesai.</>,
        ]}
      />
      <Note>
        Ini persetujuan <b>klaim</b> (bukan pembayaran). Salah ketik? Balasan angka yang tidak
        dikenali akan dibalas dengan menu bantuan — cukup kirim balasan yang benar setelahnya.
      </Note>
    </>
  ),

  "trip-ticket": (
    <>
      <H1>Ticket EnvGate per Trip</H1>
      <P>
        Setiap perjalanan (trip) pada klaim bisa dilengkapi <b>nomor ticket EnvGate</b> sebagai
        bukti pekerjaan engineer. Ada dua cara mengisinya:
      </P>
      <ul className="my-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li><b>Oleh engineer sendiri lewat WhatsApp</b> — ketik <Cmd>TICKET 3 PIM-34285</Cmd> (lihat <b>Panduan Karyawan</b>). Bisa saat konfirmasi awal maupun saat revisi.</li>
        <li><b>Oleh HR lewat web</b> — lewat tombol edit (pensil) pada baris trip, seperti di bawah.</li>
      </ul>

      <H2>Cara Mengisi Ticket (HR, via Web)</H2>
      <Steps
        items={[
          <>Buka <b>Claims Grab → Claims</b>, lalu klik klaim yang mau diedit.</>,
          <>Pada tabel <b>Bookings</b>, klik ikon <b>pensil</b> (✏️) di baris trip yang mau diberi ticket.</>,
          <>Isi kolom <b>Ticket EnvGate (bukti kerja)</b> — pilih dari saran yang muncul (50 ticket terbaru) atau ketik nomornya manual, mis. <Cmd>32535</Cmd>.</>,
          <>Klik <b>Simpan</b> — perubahan tercatat sebagai note pada klaim.</>,
        ]}
      />
      <Shot src="/docs/claims.png?v=2" caption="Tabel Bookings — kolom Ticket & tombol edit (pensil) per baris trip" />

      <H2>Yang Perlu Diketahui</H2>
      <ul className="my-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li>Ticket <b>opsional</b> — trip tanpa ticket tetap valid.</li>
        <li>Mengisi/mengubah ticket <b>tidak</b> membatalkan persetujuan Manager (berbeda dengan mengubah nominal).</li>
        <li>Kosongkan kolom lalu simpan untuk <b>menghapus</b> ticket dari trip.</li>
        <li>Nomor ticket yang muncul di Report PDF otomatis diperluas menjadi judul, status, prioritas, dan detail lain yang diambil langsung dari EnvGate.</li>
      </ul>
    </>
  ),

  report: (
    <>
      <H1>Report PDF</H1>
      <P>
        Report adalah dokumen bukti klaim yang bisa dicetak/di-PDF-kan, berisi ringkasan klaim,
        timeline persetujuan, rincian trip, kartu ticket EnvGate, dan tanda tangan. Tersedia setelah
        klaim berstatus <b>Approved</b>.
      </P>

      <H2>Cara Membuka &amp; Mencetak</H2>
      <Steps
        items={[
          <>Buka detail klaim yang sudah <b>Approved</b>.</>,
          <>Klik tombol <b>Report PDF</b> di pojok kanan atas.</>,
          <>Di halaman report, klik <b>Print / Simpan PDF</b> — pilih “Save as PDF” pada dialog cetak browser.</>,
        ]}
      />

      <H2>Isi Report</H2>
      <ul className="my-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li><b>Ringkasan</b> — karyawan, departemen, periode, jumlah trip, total biaya.</li>
        <li><b>Timeline Approval</b> — waktu konfirmasi engineer, status Manager, status HR.</li>
        <li><b>Detail Perjalanan</b> — tabel trip + kolom <b>Ticket</b> per baris (nomor + judul ticket).</li>
        <li><b>Kartu Ticket EnvGate</b> — tampilan meniru halaman ticket EnvGate: badge <Cmd>#PIM-xxxxx</Cmd>, status, prioritas, tipe, kategori, deskripsi, customer, dan agen yang mengerjakan. Satu kartu untuk referensi klaim + satu kartu per trip yang diberi ticket.</li>
        <li><b>Tanda tangan</b> — engineer, Manager, dan HR (dari data signature masing-masing).</li>
      </ul>
      <Note>
        Data ticket diambil <b>live</b> dari EnvGate saat report dibuka (cache 5 menit). Kalau
        detail ticket tidak muncul, cek halaman <b>EnvGate Test</b> — kemungkinan koneksi API
        bermasalah.
      </Note>
    </>
  ),

  envgate: (
    <>
      <H1>EnvGate Test</H1>
      <P>
        Halaman untuk memastikan koneksi ke <b>EnvGate Service Desk</b> (service desk internal
        Perkom) baik-baik saja. Data ticket di Report PDF bergantung pada koneksi ini.
      </P>

      <H2>Cara Membaca Halaman</H2>
      <ul className="my-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li><b>Banner hijau “Terhubung”</b> — API nyambung, 50 ticket terbaru berhasil diambil.</li>
        <li><b>Banner merah “Gagal”</b> — API tidak terjangkau: kredensial <Cmd>SERVICEDESK_USERNAME</Cmd>/<Cmd>SERVICEDESK_PASSWORD</Cmd> belum diset atau jaringan VPS ke servicedesk.perkom.co.id terputus.</li>
        <li><b>Tabel ticket</b> — tampilan mengikuti panel request EnvGate: <Cmd>#PIM-xxxxx</Cmd>, judul + kategori, status, agen, customer, dan help desk-nya.</li>
        <li><b>Kolom filter</b> — cari berdasarkan ID, judul, customer, atau nama agen.</li>
      </ul>
      <Note>
        Data di-cache 5 menit di server — perubahan di EnvGate baru terlihat paling lama 5 menit
        setelah refresh.
      </Note>
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
  const [navOpen, setNavOpen] = useState(false);
  const idx = FLAT.findIndex((i) => i.id === active);
  const prev = FLAT[idx - 1];
  const next = FLAT[idx + 1];

  // Daftar menu yang dipakai sidebar desktop & drawer mobile
  const navList = (onSelect?: () => void) => (
    <>
      {NAV.map((g) => (
        <div key={g.group} className="mb-5">
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {g.group}
          </p>
          {g.items.map((it) => (
            <button
              key={it.id}
              onClick={() => {
                setActive(it.id);
                onSelect?.();
              }}
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
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          {/* Menu mobile — drawer sidebar, bukan chip bulat */}
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger
              className="-ml-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Buka menu dokumentasi"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 overflow-y-auto p-4">
              <SheetTitle className="mb-3 px-3 text-sm font-bold text-slate-800">
                Dokumentasi
              </SheetTitle>
              {navList(() => setNavOpen(false))}
            </SheetContent>
          </Sheet>
          <Image src="/ogoperkom.png" alt="Perkom" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="text-sm font-bold text-slate-800">Dokumentasi Officeless Perkom</span>
          <Link href="/dashboard" className="ml-auto text-xs font-semibold text-blue-600 hover:underline">
            Buka Aplikasi →
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8">
        <aside className="sticky top-20 hidden h-fit w-56 shrink-0 lg:block">
          {navList()}
        </aside>

        <main className="min-w-0 flex-1">
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
