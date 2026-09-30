# Perkom Dashboard

Dashboard internal Perkom untuk pengelolaan klaim biaya perjalanan Grab Business — dari upload statement, parsing otomatis, sampai approval beranting via WhatsApp.

Alur singkatnya: karyawan/HR meng-upload statement Grab (PDF/CSV), sistem mem-parsing trip per karyawan menjadi klaim, lalu mengirim ringkasannya ke WhatsApp karyawan → Manager → HR untuk disetujui. Semua lewat chat: balas `1` untuk setuju, `2 <alasan>` untuk minta revisi — engineer bahkan bisa mengubah nominal trip langsung dari chat (`LIST`, `UBAH <no> <nominal>`, `SELESAI`), dan setiap catatan revisi tercatat di detail klaim.

## Fitur

- Upload & parsing statement Grab (PDF/CSV) otomatis per karyawan
- Approval & revisi via WhatsApp (Kirimi API) — bisa berulang sampai approved
- Manajemen employee dengan role EMPLOYEE / MANAGER / HR + routing approver
- Inventory asset (scan barcode), tiket Service Desk (OpenClaw), managed service claims
- Menu **User** (kelola akun login) khusus superadmin — diatur via env `SUPERADMIN_EMAILS`

## Stack

Next.js 16 (App Router) + React 19 · Tailwind CSS v4 · Supabase self-hosted (Postgres, Auth, Storage, PostgREST) di Docker Compose · Redis · Kirimi WhatsApp API.

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local   # isi kredensial Supabase/Kirimi
npm run dev
```

Migrasi database ada di `supabase/migrations/` — jalankan berurutan ke Postgres.

## Deploy

Push ke `main` memicu GitHub Actions (lint → typecheck → build) lalu deploy otomatis ke VPS. Detail setup lengkap ada di [DEPLOY.md](DEPLOY.md).
