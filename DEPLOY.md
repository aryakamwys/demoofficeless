# Deploy & Operasional VPS (Docker, self-host Supabase)

Runbook lengkap: provisioning VPS → migrasi data dari Supabase cloud → CI/CD
runner → backup harian → cutover dari Vercel → operasional & rollback harian.

Stack: satu VPS menjalankan `docker compose` dengan service `app` (Next.js),
`db` (supabase/postgres:17.6.1.136), `auth`, `rest`, `storage`, `redis`, dan
`caddy` — hanya `caddy` yang membuka port 80/443 ke luar. Routing (lihat
`deploy/Caddyfile`): `APP_DOMAIN` → `app:3000`; `SB_DOMAIN` → `/auth/v1/*` ke
`auth:9999`, `/rest/v1/*` ke `rest:3000`, `/storage/v1/*` ke `storage:5000`
(prefix di-strip). TLS otomatis oleh Caddy (ACME).

## 0. Prasyarat

- VPS Debian 12+, akses SSH **hanya lewat FortiVPN**.
- FortiGate mem-forward **hanya port 80 dan 443** ke IP VPS — selain itu tidak ada.
- DNS: dua A record, dengan pembagian yang disengaja:
  - `SB_DOMAIN` → IP publik kantor **sejak hari pertama** (sejak provisioning,
    sebelum migrasi selesai). Ini disengaja: project Supabase cloud saat ini
    tidak melayani custom domain tersebut, jadi mengarahkannya lebih awal
    membuat `TARGET_URL` di 2.6 dan verifikasi di 2.7 langsung mengenai VPS.
  - `APP_DOMAIN` → tetap ke Vercel dulu; switch final hanya dilakukan saat
    cutover (bagian 6).
- Caddy mengurus TLS otomatis begitu DNS resolve dan 80/443 terjangkau dari
  internet; tidak ada langkah sertifikat manual.
- Kredensial Supabase cloud untuk migrasi: connection string DB, service role
  key, dan URL project (untuk copy storage).

## 1. Provisioning (sekali)

Jalankan sebagai root (atau user dengan sudo) via SSH dari FortiVPN.

### 1.1 Paket dasar + firewall

```bash
apt update && apt upgrade -y
# Docker CE + docker-compose-plugin dari repo Docker — Debian stock hanya
# menyediakan docker-compose v1 yang tidak dipakai di sini
curl -fsSL https://get.docker.com | sh
apt install -y ufw git curl nodejs

ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

`nodejs` dipakai oleh skrip migrasi (`scripts/migrate/*.mjs`); Debian 12
menyediakan Node 18 — cukup untuk `fetch` global yang dibutuhkan skrip itu.

### 1.2 Hardening SSH

Pastikan login SSH dengan key sudah berfungsi **sebelum** langkah ini:

```bash
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh
```

### 1.3 User deploy + kode

```bash
adduser deploy
usermod -aG docker deploy
mkdir -p /opt/demoofficeless /opt/backups
chown deploy:deploy /opt/demoofficeless /opt/backups
su - deploy
git clone https://github.com/aryakamwys/demoofficeless.git /opt/demoofficeless
cd /opt/demoofficeless
chmod +x scripts/*.sh
```

### 1.4 Berkas .env

```bash
cp .env.vps.example .env
chmod 600 .env
nano .env
```

Isi semua nilai: `APP_DOMAIN`, `SB_DOMAIN`, `POSTGRES_PASSWORD`, `JWT_SECRET`,
`ANON_KEY`, `SERVICE_ROLE_KEY`, plus variabel aplikasi lain di template.
`ANON_KEY`/`SERVICE_ROLE_KEY` dihasilkan di 2.3 — bila stack ingin dinyalakan
sebelum migrasi, isi nilai apa pun dulu lalu perbarui di 2.4.

**`.env` wajib LF-only.** Jika file disalin/diedit dari Windows, CRLF merusak
nilai env dan membuat healthcheck deploy gagal:

```bash
sed -i 's/\r$//' .env
```

### 1.5 Nyalakan stack

```bash
docker compose up -d
docker compose ps
```

Semua service harus Up/Healthy, dan **hanya `caddy`** yang mem-binding port —
pastikan tidak ada binding `0.0.0.0:` lain di output `docker compose ps`. TLS
terbit otomatis setelah DNS mengarah ke VPS (pantau
`docker compose logs --tail=50 caddy`).

## 2. Migrasi data dari Supabase cloud

Urutan: dump cloud → restore → generate keys → isi `.env` → rebuild → copy
storage → verifikasi. Jalankan semua dari repo root (`/opt/demoofficeless`).

### 2.1 Dump database cloud

```bash
CLOUD_DB="postgresql://postgres:PASSWORD@db.PROJECT-REF.supabase.co:5432/postgres"
docker run --rm postgres:17-alpine pg_dump "$CLOUD_DB" --clean --if-exists > dump.sql
gzip dump.sql
```

Ganti `PASSWORD` dan `PROJECT-REF` dengan project Supabase cloud Anda.
Catatan: koneksi direct `db.PROJECT-REF.supabase.co:5432` hanya IPv6 tanpa
add-on IPv4 — bila dump menggantung, ganti `CLOUD_DB` dengan connection
string **session pooler** (Supabase dashboard → Connect). Dump berisi schema
+ data saja — roles internal Supabase sudah dibuat oleh init scripts image
`db` self-host, jadi tidak ikut dimigrasikan.

### 2.2 Restore ke db self-host

```bash
./scripts/restore.sh dump.sql.gz
```

Ketik `YA` saat konfirmasi. Skrip menjalankan
`gunzip -c "$FILE" | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres`,
sehingga error pertama langsung menghentikan restore — tidak ada objek yang
terlewat diam-diam. Bila restore berhenti dengan error role tidak ada (mis.
`supabase_read_only_user`), buat role-nya dulu —
`CREATE ROLE "<nama>";` di psql — lalu jalankan ulang restore (aman karena
dump memakai `--clean --if-exists`).

### 2.3 Generate ANON_KEY & SERVICE_ROLE_KEY

```bash
set -a; . ./.env; set +a
node scripts/migrate/generate-keys.mjs "$JWT_SECRET"
```

Output berupa `ANON_KEY=...` dan `SERVICE_ROLE_KEY=...`.

### 2.4 Lengkapi .env

Salin hasil 2.3 ke `.env`:

- `ANON_KEY` dan `SERVICE_ROLE_KEY` — output 2.3
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — nilai yang sama dengan `ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — nilai yang sama dengan `SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL` — `https://` + nilai `SB_DOMAIN`, ditulis literal (lihat bagian 8)

### 2.5 Rebuild + nyalakan

```bash
docker compose up -d --build
```

### 2.6 Copy storage bucket `dataperkom`

```bash
set -a; . ./.env; set +a
export CLOUD_URL="https://PROJECT-REF.supabase.co"
export CLOUD_SERVICE_KEY="SERVICE-ROLE-KEY-CLOUD"
export TARGET_URL="https://$SB_DOMAIN"
export TARGET_SERVICE_KEY="$SERVICE_ROLE_KEY"
node scripts/migrate/copy-storage.mjs
```

Skrip mengunduh semua objek bucket `dataperkom` dari cloud lalu mengunggah ke
self-host dengan header `x-upsert` (menimpa bila objek sudah ada).
`TARGET_URL="https://$SB_DOMAIN"` terbukti mengenai VPS — A record
`SB_DOMAIN` sudah mengarah ke IP publik kantor sejak hari pertama (bagian 0).

### 2.7 Verifikasi

```bash
set -a; . ./.env; set +a
curl -I "https://$SB_DOMAIN/rest/v1/"
```

Status harus bukan 5xx (401 tanpa apikey itu normal). Pastikan respons
benar-benar datang dari self-host, bukan cloud: `docker compose logs rest
--tail=5` harus memunculkan request HEAD tadi (dan `docker compose logs
storage --tail=5` saat PDF dibuka) — ini bekerja karena `SB_DOMAIN` sudah
resolve ke VPS sejak hari pertama (bagian 0). Lalu dari browser: login dengan
akun lama, dan buka salah satu PDF claim lama untuk memastikan storage ikut
pindah.

## 3. Runner CI/CD (GitHub Actions self-hosted)

CI (`.github/workflows/ci.yml`) menjalankan quality (npm ci, lint, tsc, build)
di `ubuntu-latest` untuk setiap pull request dan push. Job deploy hanya jalan
saat push ke `main`, di runner berlabel `vps`, dengan `concurrency` group
`deploy` (satu deploy pada satu waktu).

### 3.1 Buat user runner

```bash
sudo useradd -m -s /bin/bash runner
sudo usermod -aG docker runner
```

Runner menjalankan `scripts/deploy.sh` yang melakukan `git fetch` + `git
reset --hard` di repo, jadi repo harus writable oleh runner; `.env` tetap
terbaca deploy (cron backup) maupun runner lewat group `docker`:

```bash
sudo chown -R runner:runner /opt/demoofficeless
sudo chgrp docker /opt/demoofficeless/.env && sudo chmod 640 /opt/demoofficeless/.env
```

### 3.2 Pasang runner

Di GitHub: **Settings → Actions → Runners → New self-hosted runner →
Linux x64**. Ikuti panduan download sebagai user runner — salin perintah
download + extract persis dari halaman itu (berisi versi terbaru), lalu saat
`config.sh` tambahkan label `vps`:

```bash
sudo su - runner
mkdir actions-runner && cd actions-runner
# curl -o actions-runner-linux-x64-*.tar.gz -L <download-url-dari-halaman-github>
# tar xzf actions-runner-linux-x64-*.tar.gz
./config.sh --url https://github.com/aryakamwys/demoofficeless --token TOKEN-DARI-HALAMAN-GITHUB --labels vps
exit
```

Token registrasi hanya berlaku ~1 jam — salin dari halaman yang sama saat
menjalankan `config.sh`. Jawab prompt "run agent as service?" dengan yes, atau
pasang service secara manual sebagai root:

```bash
cd /home/runner/actions-runner
sudo ./svc.sh install && sudo ./svc.sh start
```

Cek status runner berlabel `vps` muncul Idle di halaman Runners GitHub.

### 3.3 Proteksi runner (wajib — repo ini publik)

Guard `if: push main` hidup di file workflow yang sama yang bisa dimodifikasi
oleh PR dari fork — tanpa proteksi tambahan, PR jahat bisa menjadwalkan shell
arbitrary di runner VPS. Job deploy memakai `environment: production`; sekali
saja, aktifkan proteksinya di GitHub:

1. **Settings → Environments → New environment** → nama `production` →
   aktifkan **Required reviewers** dan tambahkan owner/admin repo.
2. **Settings → Actions → General** → aktifkan
   **Require approval for all external contributors**.

Dengan environment protection, **setiap** deploy menunggu persetujuan satu
klik di GitHub dulu — disengaja untuk repo ini: runner berjalan di jaringan
kantor, jadi setiap eksekusi di sana harus melewati reviewer.

## 4. Backup harian (cron)

`scripts/backup.sh` (dijalankan dari repo root) membuat:

- `/opt/backups/db-*.sql.gz` — `docker compose exec -T db pg_dumpall -U postgres --clean --if-exists | gzip`
- `/opt/backups/storage-*.tar.gz` — tar volume storage Supabase
- Retensi otomatis: simpan 7 file db terakhir dan 4 file storage terakhir

Pasang cron sebagai user `deploy`:

```bash
crontab -e -u deploy
```

Tambahkan baris:

```cron
15 2 * * * cd /opt/demoofficeless && ./scripts/backup.sh >> /opt/backups/backup.log 2>&1
```

Uji manual sekali sebagai deploy, lalu pastikan dua file baru muncul:

```bash
sudo su - deploy -c 'cd /opt/demoofficeless && ./scripts/backup.sh'
ls -lt /opt/backups | head
```

## 5. Deploy & rollback harian

### 5.1 Otomatis (push ke main)

Setiap push ke `main` memicu job deploy di runner `vps`, yang menjalankan
`bash /opt/demoofficeless/scripts/deploy.sh "$GITHUB_SHA"`. Skrip itu:

1. `source ./.env`, `git fetch` + `git reset --hard $SHA`
2. `docker compose build app`, lalu tag image menjadi `demoofficeless-app:git-<sha12>`
3. Backup best-effort (`./scripts/backup.sh`)
4. `docker compose up -d --wait app`, lalu healthcheck
   `curl -fsS --max-time 15 http://127.0.0.1:3000/login`
   (loopback publish milik service `app` — tanpa dependensi DNS/sertifikat)
5. Bila container/healthcheck gagal → rollback otomatis: image
   `git-<sha12>` sebelumnya di-tag balik ke `latest` lalu di-force-recreate
   (tanpa rebuild)
6. Menulis versi ke `.deploy-current` dan memangkas image lama (sisakan 5)

Catatan: deploy.sh hanya menaikkan service `app` — perubahan pada
`deploy/Caddyfile` tambahan memerlukan `docker compose restart caddy` manual
di VPS setelah deploy (lihat bagian 7).

Cek versi yang berjalan:

```bash
cat /opt/demoofficeless/.deploy-current
```

### 5.2 Deploy manual

Jalankan sebagai `runner` (pemilik repo):

```bash
sudo su - runner -c 'cd /opt/demoofficeless && git pull && docker compose up -d --build'
```

`NEXT_PUBLIC_*` dibake saat build image — perubahan nilainya wajib rebuild
(`--build`), cukup restart tidak cukup.

### 5.3 Rollback manual

Rollback standar — wajib `--build`: tanpa itu compose memakai image `latest`
yang sudah ada, sehingga rollback diam-diam tidak mengubah apa pun (rebuild,
butuh beberapa menit):

```bash
sudo su - runner -c 'cd /opt/demoofficeless && git checkout SHA && docker compose up -d --build --wait app'
```

Fallback cepat: deploy menyimpan image per commit — daftar lalu tag balik ke
`latest` tanpa rebuild:

```bash
docker images demoofficeless-app --format '{{.Tag}}'
sudo su - runner -c 'cd /opt/demoofficeless && docker tag demoofficeless-app:git-SHA12 demoofficeless-app:latest && docker compose up -d --wait app'
```

## 6. Cutover dari Vercel / Supabase cloud

### 6.1 Dry-run via SSH tunnel (tanpa menyentuh DNS)

Bypass `/etc/hosts` untuk `APP_DOMAIN` **tidak bisa dipakai pra-cutover**:
selama DNS domain itu masih mengarah ke Vercel, challenge ACME untuknya
mendarat di Vercel, jadi VPS tidak pernah punya sertifikat domain tersebut dan
browser menolak koneksi HTTPS ke IP kantor. Gunakan SSH tunnel ke port
internal aplikasi:

```bash
ssh -L 3000:127.0.0.1:3000 user@vps
```

Lalu buka `http://localhost:3000/login` di komputer admin — bekerja karena
compose mem-publish `app` ke `127.0.0.1:3000` di host (loopback saja, tidak
terjangkau dari luar). Batasi ekspektasi: tanpa domain
asli, cookie/login bisa terganggu — perlakukan ini sebagai smoke check
(halaman login merespons), bukan uji penuh. PDF claim lama sudah bisa diuji
penuh via `SB_DOMAIN` sejak provisioning (bagian 2.7).

### 6.2 Persiapan DNS

H-1: turunkan TTL A record `APP_DOMAIN` (mis. ke 300 detik) agar switch saat
cutover cepat terpropagasi. (`SB_DOMAIN` tidak di-switch — sudah mengarah ke
VPS sejak hari pertama.)

### 6.3 Cutover (jam di luar jam kerja)

1. **Freeze** — hentikan penulisan data di versi cloud (pengguna berhenti
   memakai aplikasi; Vercel bisa dipause sementara).
2. **Final dump + restore** — ulangi 2.1 dan 2.2 dengan dump terbaru.
3. **Switch DNS — hanya `APP_DOMAIN`** — ubah A record-nya ke IP publik
   kantor, lalu di VPS jalankan `docker compose restart caddy`: caddy sudah
   mencoba ACME untuk domain ini sejak awal dan sedang dalam backoff retry —
   restart me-reset backoff sehingga sertifikat terbit segera, bukan
   berjam-jam kemudian. `SB_DOMAIN` tidak disentuh: sudah mengarah ke VPS
   sejak hari pertama.
4. **Final storage sync** — ulangi 2.6 untuk objek yang berubah sejak copy
   pertama (`x-upsert` membuat aman dijalankan ulang). Aman dijalankan setelah
   switch karena `TARGET_URL` mengenai VPS lewat `SB_DOMAIN`.
5. **Pantau** — login, buat claim baru, cek `docker compose logs --tail=50 app`
   dan `caddy` selama beberapa jam pertama.

### 6.4 Masa rollback 7 hari

Selama 7 hari setelah cutover, rollback = kembalikan A record `APP_DOMAIN` ke
Vercel (deployment Vercel akan memakai Supabase cloud yang datanya beku sejak
cutover). Catatan: data yang ditulis ke VPS setelah cutover tidak ada di
cloud — sinkronkan manual bila terpaksa rollback.

### 6.5 Arsip akhir + decommission

Setelah 7 hari stabil:

1. Jalankan backup final dan simpan kedua arsip di luar VPS (dump DB + tar
   storage):

```bash
sudo su - deploy -c 'cd /opt/demoofficeless && ./scripts/backup.sh'
ls -lt /opt/backups | head
# salin db-*.sql.gz dan storage-*.tar.gz terbaru ke lokasi arsip eksternal
```

2. Decommission project Vercel dan project Supabase cloud (setelah arsip
   terverifikasi tersimpan).

## 7. Troubleshooting cepat

**Status service:**

```bash
cd /opt/demoofficeless && docker compose ps
```

**Log service** (`app`, `db`, `auth`, `rest`, `storage`, `redis`, `caddy`):

```bash
docker compose logs --tail=50 app
```

**Validasi Caddyfile** (setelah edit `deploy/Caddyfile`, restart caddy):

```bash
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
docker compose restart caddy
```

Edit `deploy/Caddyfile` selalu di repo dan terapkan lewat git (push → deploy
CI, atau `git pull` manual) — edit langsung di VPS akan hilang ditimpa
`git reset --hard` dari deploy.sh pada deploy berikutnya.

**Restore dari backup:**

```bash
ls -t /opt/backups/db-*.sql.gz | head -3
./scripts/restore.sh "$(ls -t /opt/backups/db-*.sql.gz | head -1)"
```

**TLS tidak terbit** — pastikan DNS `SB_DOMAIN` (dan `APP_DOMAIN` setelah
cutover) mengarah ke IP publik kantor dan FortiGate meneruskan 80+443; lalu
baca log ACME:

```bash
docker compose logs --tail=50 caddy
```

**Deploy gagal / healthcheck** — deploy.sh otomatis rollback; cek versi
berjalan (`cat .deploy-current`), log app, dan log runner:
`journalctl -u actions.runner.* --no-pager -n 50`.

**Nilai env aneh / healthcheck selalu gagal setelah edit .env dari Windows** —
CRLF. Perbaiki lalu restart:

```bash
sed -i 's/\r$//' .env && docker compose up -d --force-recreate app
```

## 8. Catatan env

- `.env` **wajib LF-only** dan `chmod 600` (atau `640` group `docker` setelah
  runner dipasang). Dibuat dari `.env.vps.example`: `cp .env.vps.example .env`.
- Enam nilai dipakai **interpolasi compose** sendiri: `APP_DOMAIN`,
  `SB_DOMAIN`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`,
  `SERVICE_ROLE_KEY`. Service `app` menerima seluruh `.env` lewat `env_file`.
- `env_file` **tidak** mendukung interpolasi — karena itu
  `NEXT_PUBLIC_SUPABASE_URL` harus ditulis literal dan **selalu mengikuti
  nilai `SB_DOMAIN`**. Ganti `SB_DOMAIN` = ganti URL itu juga, lalu rebuild.
- `ANON_KEY`/`SERVICE_ROLE_KEY` hasil `generate-keys.mjs` punya masa berlaku
  sampai **2030-01-01** — jadwalkan regenerasi + update `.env` sebelum itu.
- `NEXT_PUBLIC_*` dibake ke bundle saat build image: setiap perubahan
  wajib `docker compose up -d --build`.
