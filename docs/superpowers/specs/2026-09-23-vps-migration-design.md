# Design: Migrasi Vercel + Supabase → VPS Kantor (Docker)

Tanggal: 2026-09-23
Status: Draft — menunggu review

## 1. Konteks & Tujuan

Aplikasi (Next.js 16 standalone) saat ini: app di Vercel, data/auth/storage di
Supabase cloud, cache di Upstash. Tujuan: seluruh stack jalan di VPS Debian
kantor dalam Docker, data dimigrasi apa adanya ("masih sama"), deploy aman +
CI/CD + quality gate, mengikuti praktik senior DevOps (security, downtime,
rollback, backup).

Keputusan yang sudah dikonfirmasi bersama user:

| Keputusan | Nilai |
|---|---|
| Spek VPS | 40 GB RAM (cukup untuk apa pun) |
| Akses SSH/manajemen | Hanya via FortiVPN (tidak ada SSH publik) |
| Akses aplikasi | Publik (user luar kantor + webhook Kirimi) via port-forward 443/80 |
| Domain | Subdomain kantor (mis. `app.perkom.co.id` + `supabase.perkom.co.id`) |
| CI/CD | GitHub Actions, deploy via **self-hosted runner di VPS** (bukan SSH) |
| Redis | Container di VPS (Upstash ditinggalkan) |
| Pendekatan Supabase | **Self-host Supabase** (approach A — nol perubahan kode) |

## 2. Arsitektur Target

```
Internet ──> FortiGate (hanya forward 443/80 → VPS)
              │
              v
            VPS Debian (Docker)
            ┌────────────────────────────────────────────────┐
            │ nginx + certbot (80/443, TLS Let's Encrypt)     │
            │   ├─ app.perkom.co.id    → app:3000             │
            │   └─ supabase.perkom.co.id → kong:8000          │
            │                                    │            │
            │ app (next standalone)   redis      │            │
            │ kong → auth(gotrue) / rest / storage-api         │
            │        postgres (+ volumes data)  │            │
            │ gh-runner (GitHub Actions self-hosted)          │
            │ backup cron (pg_dump + tar storage)             │
            └────────────────────────────────────────────────┘
Admin/SSH ──> FortiVPN ──> VPS:22 (key-only)
```

Prinsip: hanya nginx yang mendengar di 0.0.0.0 (80/443). Postgres, kong,
redis, auth, storage **tidak publish port** — hanya jaringan internal Docker.

## 3. Komponen

### 3.1 Compose stack (1 repo, 1 `docker-compose.yml` + override)
- `app` — image existing (multi-stage, node:22-alpine, non-root, standalone).
- `nginx` — reverse proxy (site conf di-duplicate dari `deploy/nginx/` di repo),
      TLS via certbot `--nginx` (renew otomatis oleh systemd timer certbot).
- `db` — `supabase/postgres` (versi mayor ≥ versi DB cloud saat dump).
- `auth` (gotrue), `rest` (postgrest), `storage-api`, `kong` — subset
  self-host Supabase resmi. Yang TIDAK dipasang (tidak dipakai app):
  realtime, edge-runtime, analytics/logflare, vector, imgproxy, studio.
  (Studio opsional bila kelak butuh UI admin DB.)
- `redis` — cache (menggantikan Upstash).
- `gh-runner` — GitHub Actions self-hosted runner (label: `vps`).
- `backup` — container cron: `pg_dump` harian + tar volume storage.

### 3.2 Env & secrets
- `.env` di VPS (chmod 600, owner deploy user, TIDAK di-commit) berisi:
  kredensial Postgres, JWT secret, anon/service key self-host, Kirimi,
  Service Desk, `SITE_URL`, `SUPABASE_URL` internal.
- `NEXT_PUBLIC_SUPABASE_URL=https://supabase.perkom.co.id` — browser client
  butuh HTTPS publik ke gateway (kong).
- Tidak ada secret yang dibake ke image (build args hanya untuk nilai
  `NEXT_PUBLIC_*` yang memang publik by design).

## 4. Migrasi Data (Supabase cloud → self-host)

Urutan yang menjaga "masih sama":

1. **Full pg_dump** dari cloud (skema `public` + `auth` + `storage` + role
   yang relevan, format SQL plain) → restore ke `db` self-host.
   Semua tabel, users + password hash, metadata object storage ikut.
2. **JWT secret**: salin JWT secret project cloud (Dashboard → Settings →
   API) ke `GOTRUE_JWT_SECRET` self-host → sesi login aktif tidak logout.
3. **Key baru**: anon & service key self-host = JWT yang ditandatangani
   secret yang sama (klaim `role: anon` / `service_role`) — generate via
   one-liner node saat migrasi. Ganti nilai `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   & `SUPABASE_SERVICE_ROLE_KEY`.
4. **File storage bucket `dataperkom`**: unduh semua objek dari cloud (list +
   download pakai service key) → letakkan di volume storage-api dengan path
   objek yang sama. Verifikasi: fetch satu `file_url` publik hasil restore.
   Fallback bila layout tidak cocok: wipe baris `storage.objects` bucket itu
   lalu re-upload via API self-host (metadata baru, file tetap sama).
5. **Verifikasi menyeluruh** sebelum cutover: login user lama, buka claim
   detail (tiket + file PDF), upload baru, kirim WA test, scan inventory.

Data berukuran kecil (tabel klaim + PDF) — dump/restore hitungan menit.

## 5. Keamanan

- FortiGate: forward **hanya** 80/443 ke VPS. SSH tidak di-forward.
- UFW di VPS: allow 22 (dari subnet VPN saja bila memungkinkan), 80, 443;
  default deny lain.
- SSH: key-only (`PasswordAuthentication no`), no root login.
- Internal service (db/kong/redis/auth/storage): tanpa `ports:`, hanya
  jaringan internal compose; Postgres password kuat.
- `.env` chmod 600; service-role key hanya di env server.
- Container: `restart: unless-stopped` + `healthcheck` di app/db/redis.
- Runner GitHub: hanya jalankan job deploy pada `push` ke `main`
  (bukan `pull_request`) supaya fork/PR asing tidak mengeksekusi kode di
  server. Job quality tetap di runner GitHub-hosted.
- Backup terenkripsi bila disimpan di luar VPS (opsional rclone ke cloud
  storage milik sendiri).

## 6. CI/CD & Quality Gate (GitHub Actions)

`ci.yml` — trigger `pull_request` + `push` ke main:

```
job quality (runs-on: ubuntu-latest):
  npm ci → npm run lint → npx tsc --noEmit → npm run build
  (PR wajib hijau sebelum bisa merge)

job deploy (runs-on: [self-hosted, vps], needs: quality,
            only push ke main):
  1. checkout / git pull di /opt/demoofficeless
  2. docker compose build (tag image = git sha pendek)
  3. pre-deploy backup: pg_dump ke folder backup
  4. docker compose up -d --wait (healthcheck gate)
  5. verify: curl https://app.perkom.co.id/login → 200
  6. gagal → otomatis rollback: up -d image tag sebelumnya + report job gagal
```

- Image di-tag `demoofficeless:<sha>`; dua tag terakhir dipertahankan
  (kebutuhan rollback), sisanya di-prune.
- Deploy = beberapa detik blur pada container app (compose recreate);
  acceptable untuk aplikasi internal. Upgrade ke blue-green dua container
  app bila kelak butuh benar-benar zero-downtime.

## 7. Rencana Cutover (minim downtime)

1. **H-1**: stack jalan penuh di VPS, restore dump awal, verifikasi via
   `/etc/hosts` override. Lower DNS TTL ke 300s.
2. **Hari-H (off-hours)**: freeze write (tampilkan maintenance page di
   Vercel atau cukup jam sepi) → final pg_dump + copy file storage baru →
   restore → smoke test internal → switch DNS ke IP publik kantor.
3. **Rollback window**: DNS balik ke Vercel (data cloud utuh sampai
   cutover). Rollback hanya untuk kegagalan cutover langsung — setelah ada
   write baru di VPS, jangan rollback data.
4. **H+7**: matikan project Vercel + Supabase cloud setelah seminggu stabil.
   Ekspor arsip final (dump + file) sebelum delete.

## 8. Backup & Operasional

- Nightly `pg_dump` + tar volume storage → `/opt/backups` (retensi 7 harian,
  4 mingguan) + salinan mingguan keluar VPS (rclone/rsync).
- Log: `docker compose logs` / journald; tidak ada log aggregator (YAGNI,
  internal app).
- Monitoring: healthcheck compose + optional Uptime Kuma bila mau alert
  proaktif (default: tidak dipasang).
- Dokumen runbook update: `DEPLOY.md` diganti isi baru sesuai skema ini.

## 9. Testing / Acceptance

- [ ] CI di GitHub hijau (lint/tsc/build) pada PR dummy
- [ ] Deploy otomatis jalan sampai healthcheck & verify 200
- [ ] Login user lama tanpa reset password
- [ ] Data claim/trip/signature identik dengan cloud (spot check)
- [ ] PDF lama bisa dibuka; upload baru tersimpan di VPS
- [ ] Kirimi WA terkirim; webhook diterima dari internet
- [ ] Inventory scan kamera jalan (HTTPS)
- [ ] Backup nightly menghasilkan file & ter-restore di tes
- [ ] Port scan dari luar: hanya 80/443 terbuka

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Layout file storage-api tidak sesuai dugaan | Fallback re-upload via API (§4.4) |
| Versi Postgres cloud > image self-host | Pilih tag image sesuai/more baru sebelum dump |
| Runner self-host dieksekusi via PR fork | Deploy hanya `push main`, quality job di hosted |
| Kantor mati listrik/internet → app & WA down | Di luar scope (single-site); catat sebagai risiko diterima |
| Kehilangan data pasca-cutover | Backup nightly + arsip final sebelum decommission |
