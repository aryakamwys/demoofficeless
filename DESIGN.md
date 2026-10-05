---
tokens:
  color:
    primary: blue-600
    primary_soft_bg: blue-50
    text_active: blue-700
    neutral: slate (50–700)
    border: slate-200 (layout) / slate-300 (table)
    success: emerald-700 on emerald-50
    warning: amber-700 on amber-50
    muted: slate-500
  typography:
    page_title: text-lg font-semibold
    nav_item: text-sm font-medium
    table: text-[11px]
  spacing:
    table_cell: px-2 py-2
    table_header: px-3 py-3
  component:
    active_item: bg-blue-50/50 text-blue-700 + absolute left bar w-1 bg-blue-600
    table_header: bg-slate-100 border-slate-300 font-semibold text-slate-700
    badge: tinted pill (bg-*-50 text-*-700)
    card: rounded-xl border border-slate-200 bg-white p-5
    icon_tile: rounded-xl p-2.5 tinted (bg-*-50 text-*-600); ungu hanya aksen OpenClaw (referensi user)
    progress_bar: h-1.5 rounded-full bg-slate-100, fill bg-<accent> (blue/emerald/amber/purple)
    landing:
      navbar: pill mengambang sticky top-4 — rounded-full border-white/60 bg-white/70 backdrop-blur-xl backdrop-saturate-150 shadow; logo h-7 + nama, kanan Dokumentasi/Changelog + tombol Masuk (rounded-full)
      opening_card: satu kartu terpusat max-w-xl rounded-2xl border-slate-200 bg-white p-8/10 text-center shadow-sm (gaya docs.bagibagi.co) — logo tile, judul, deskripsi singkat, CTA Masuk/Dokumentasi
      footer: bg-slate-50 border-t, 3 kolom (brand+tagline / Kontak / Tautan) + bar copyright © 2026 PT Perkom
    changelog:
      entry: baris tanggal (text-sm text-slate-500) + badge tipe tinted pill (Baru=emerald, Fitur=blue, Peningkatan=amber, Perbaikan=slate), judul text-xl font-semibold, deskripsi, list bernomor; kolom max-w-2xl
    auth_page:
      layout: satu halaman penuh TANPA kartu — bg-slate-50, kolom max-w-sm terpusat: logo tile + judul + sub + form + catatan kaki
      input: pill h-11 rounded-full, ikon lucide absolute left-4 text-slate-400
      button: pill h-11 rounded-full w-full bg-primary
---

# DESIGN.md — Perkom Dashboard

Token di atas diekstrak dari UI existing (sidebar, header, tabel Request EnvGate).
Semua UI baru wajib pakai token ini — jangan introduce warna/spacing baru.
