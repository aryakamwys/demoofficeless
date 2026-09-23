# VPS Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pindahkan seluruh stack (app + Supabase self-host + Redis + CI/CD + backup harian) ke VPS Debian kantor, dengan Caddy sebagai reverse proxy domain, tanpa mengubah kode aplikasi.

**Architecture:** App Next.js standalone + Supabase self-host (db/auth/rest/storage, TANPA gateway envoy/kong — Caddy routing langsung ke service) + Redis + self-hosted GitHub Actions runner, semuanya Docker. FortiGate hanya forward 80/443; SSH via FortiVPN saja.

**Tech Stack:** Docker Compose, supabase/postgres:17.6.1.136, supabase/gotrue:v2.196.0, postgrest/postgrest:v14.17, supabase/storage-api:v1.74.0, caddy:2 (TLS otomatis), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-23-vps-migration-design.md`

## Global Constraints

- Domain: `APP_DOMAIN` (mis. `app.perkom.co.id`) dan `SB_DOMAIN` (mis. `supabase.perkom.co.id`) — dipakai konsisten di semua file via env/placeholder.
- Hanya container `caddy` yang publish port (80/443 ke 0.0.0.0). App, auth, rest, storage, Postgres, Redis: **tanpa port** — internal Docker saja, Caddy memanggil via nama service.
- Tidak ada secret di repo; template env di `.env.vps.example`.
- NEXT_PUBLIC_* di-bake saat build (sudah benar di Dockerfile — build args).
- Deploy job HANYA pada `push` ke `main`; PR hanya menjalankan quality.
- Deviasi kecil dari spec (disetujui di plan ini): backup via host cron + `scripts/backup.sh` (bukan container cron) — lebih sedikit komponen, hasilnya sama.

---

### Task 1: Docker Compose stack lengkap (app + supabase self-host + redis + caddy)

**Files:**
- Modify: `docker-compose.yml` (replace isi, service `app` dipertahankan)
- Create: `.env.vps.example`
- Create: `deploy/Caddyfile` (isi di Task 2 — mount sudah disiapkan di sini)

**Interfaces:**
- Produces: services `app`, `db`, `auth`, `rest`, `storage`, `redis`, `caddy` (satu-satunya yang publish 80/443); volumes `db-data`, `storage-data`, `caddy_data`. Env vars persis seperti `.env.vps.example`.

- [ ] **Step 1: Tulis `docker-compose.yml` baru**

```yaml
name: demoofficeless

services:
  app:
    build:
      context: .
      args:
        NEXT_PUBLIC_SUPABASE_URL: https://${SB_DOMAIN}
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${ANON_KEY}
    image: demoofficeless-app:latest
    env_file: .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    depends_on:
      db:
        condition: service_healthy

  db:
    image: supabase/postgres:17.6.1.136
    container_name: supabase-db
    environment:
      POSTGRES_HOST: /var/run/postgresql
      PGPORT: 5432
      POSTGRES_PORT: 5432
      PGPASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data
      JWT_EXP: 3600
    volumes:
      - db-data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  auth:
    image: supabase/gotrue:v2.196.0
    container_name: supabase-auth
    depends_on:
      db:
        condition: service_healthy
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: https://${SB_DOMAIN}
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@db:5432/postgres
      GOTRUE_SITE_URL: https://${APP_DOMAIN}
      GOTRUE_URI_ALLOW_LIST: https://${APP_DOMAIN}/*
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_JWT_ISSUER: supabase
      GOTRUE_JWT_EXP: 3600
      GOTRUE_MAILER_AUTOCONFIRM: "true"
      GOTRUE_DISABLE_SIGNUP: "false"
    restart: unless-stopped

  rest:
    image: postgrest/postgrest:v14.17
    container_name: supabase-rest
    depends_on:
      db:
        condition: service_healthy
    environment:
      PGRST_DB_URI: postgres://authenticator:${POSTGRES_PASSWORD}@db:5432/postgres
      PGRST_DB_SCHEMAS: public,storage
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${JWT_SECRET}
      PGRST_DB_MAX_ROWS: "1000"
      PGRST_SERVER_PORT: "3000"
    restart: unless-stopped

  storage:
    image: supabase/storage-api:v1.74.0
    container_name: supabase-storage
    depends_on:
      db:
        condition: service_healthy
      rest:
        condition: service_started
    environment:
      ANON_KEY: ${ANON_KEY}
      SERVICE_KEY: ${SERVICE_ROLE_KEY}
      POSTGREST_URL: http://rest:3000
      AUTH_JWT_SECRET: ${JWT_SECRET}
      DATABASE_URL: postgres://supabase_storage_admin:${POSTGRES_PASSWORD}@db:5432/postgres
      STORAGE_BACKEND: file
      FILE_STORAGE_BACKEND_PATH: /var/lib/storage
      GLOBAL_S3_BUCKET: staging
      TENANT_ID: stub
      # imgproxy tidak dipasang — transformasi gambar tidak dipakai (PDF only)
      IMGPROXY_URL: ""
    volumes:
      - storage-data:/var/lib/storage
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      APP_DOMAIN: ${APP_DOMAIN}
      SB_DOMAIN: ${SB_DOMAIN}
    volumes:
      - ./deploy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app
      - auth
      - rest
      - storage

volumes:
  db-data:
  storage-data:
  caddy_data:
  caddy_config:
```

- [ ] **Step 2: Tulis `.env.vps.example`** (template lengkap server)

```bash
# ============================================================
# VPS production env — salin ke .env di VPS, chmod 600
# ============================================================

# --- Domain ---
APP_DOMAIN=app.perkom.co.id
SB_DOMAIN=supabase.perkom.co.id

# --- Postgres self-host (password kuat, generate: openssl rand -hex 24) ---
POSTGRES_PASSWORD=<password-kuat>

# --- Supabase JWT & keys ---
# JWT_SECRET = JWT secret project cloud Supabase (Dashboard → Settings → API)
# agar sesi login lama tetap valid. ANON_KEY & SERVICE_ROLE_KEY di-generate
# via: node scripts/migrate/generate-keys.mjs $JWT_SECRET
JWT_SECRET=<jwt-secret-dari-cloud>
ANON_KEY=<generate>
SERVICE_ROLE_KEY=<generate>

# --- App (Next.js) ---
# Catatan: NEXT_PUBLIC_* juga di-bake saat build via compose build args
NEXT_PUBLIC_SUPABASE_URL=https://supabase.perkom.co.id
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
KIRIMI_USER_CODE=
KIRIMI_SECRET=
KIRIMI_DEVICE_ID=
SERVICEDESK_USERNAME=
SERVICEDESK_PASSWORD=

# --- Redis (internal, tanpa auth — tidak keluar jaringan Docker) ---
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
REDIS_INTERNAL_URL=redis://redis:6379
```

Catatan: `lib/cache.ts` masih membaca `UPSTASH_REDIS_REST_URL/TOKEN`. Task 1 juga mengubah `lib/cache.ts` agar memakai `REDIS_INTERNAL_URL` via paket `redis` node? TIDAK — perubahan kode dilarang (konstraint spec "nol perubahan kode" untuk logika app). Solusi tanpa ubah kode: jalankan `redis` kompatibel REST? Tidak ada. MAKA keputusan: cache di VPS fallback no-cache sampai Task 5 mengganti `lib/cache.ts` minimal (lihat Task 5) — satu-satunya perubahan kode yang disetujui.

- [ ] **Step 3: Verifikasi sintaks**

Run: `docker compose config -q` (atau `docker compose -f docker-compose.yml config --quiet`)
Expected: exit 0 tanpa error (butuh `.env` dummy lokal untuk interpolasi — buat sementara lalu hapus).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.vps.example
git commit -m "feat(compose): self-host supabase stack (db/auth/rest/storage/redis), localhost-only ports"
```

---

### Task 2: Caddyfile — reverse proxy dua domain + TLS otomatis

**Files:**
- Create: `deploy/Caddyfile`

**Interfaces:**
- Consumes: service `caddy` + env `APP_DOMAIN`/`SB_DOMAIN` dari Task 1; service internal `app:3000`, `auth:9999`, `rest:3000`, `storage:5000`.
- Produces: `APP_DOMAIN` → app; `SB_DOMAIN/{auth,rest,storage}/v1/*` → service (prefix di-strip via `handle_path`); TLS Let's Encrypt otomatis.

- [ ] **Step 1: Tulis `deploy/Caddyfile`**

```caddyfile
# Reverse proxy utama — TLS Let's Encrypt otomatis, tidak perlu certbot.
# Domain dibaca dari env APP_DOMAIN / SB_DOMAIN (lihat compose service caddy).

{
	email admin@perkom.co.id	# email akun ACME — ganti sesuai kantor
}

{$APP_DOMAIN} {
	encode gzip
	request_body {
		max_size 25MB		# upload PDF klaim
	}
	reverse_proxy app:3000
}

{$SB_DOMAIN} {
	request_body {
		max_size 25MB
	}
	# handle_path meng-strip prefix yang cocok — service menerima path tanpa /xxx/v1
	handle_path /auth/v1/* {
		reverse_proxy auth:9999
	}
	handle_path /rest/v1/* {
		reverse_proxy rest:3000
	}
	handle_path /storage/v1/* {
		reverse_proxy storage:5000
	}
}
```

- [ ] **Step 2: Verifikasi sintaks lokal**

Run: `docker run --rm -v "$(pwd)/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile 2>&1 | tail -3`
Expected: `Valid configuration` (env belum diset bisa memunculkan warning kosong `{$APP_DOMAIN}` — tetap valid).

- [ ] **Step 3: Commit**

```bash
git add deploy/Caddyfile
git commit -m "feat(caddy): reverse proxy + auto-TLS for app and supabase subdomains"
```

---

### Task 3: Backup & restore harian

**Files:**
- Create: `scripts/backup.sh`
- Create: `scripts/restore.sh`
- Modify: `DEPLOY.md` (crontab entry ditambahkan di Task 6 runbook; tidak di sini)

**Interfaces:**
- Consumes: service `db`, volume `storage-data`, `.env` (`POSTGRES_PASSWORD`).
- Produces: `/opt/backups/db-YYYYMMDD-HHmmss.sql.gz` + `storage-YYYYMMDD-HHmmss.tar.gz`; retensi 7 harian + 4 mingguan (Minggu). Restore: `scripts/restore.sh <file.sql.gz>`.

- [ ] **Step 1: Tulis `scripts/backup.sh`**

```bash
#!/usr/bin/env bash
# Backup harian: dump Postgres + tar volume storage + rotasi retensi.
# Jalankan dari root repo (crontab VPS): cd /opt/demoofficeless && ./scripts/backup.sh
set -euo pipefail

BACKUP_DIR=/opt/backups
STAMP=$(date +%Y%m%d-%H%M%S)
WEEKDAY=$(date +%u)   # 7 = Minggu

mkdir -p "$BACKUP_DIR"

# 1. Dump database ( semua schema: public/auth/storage )
docker compose exec -T db pg_dumpall -U postgres --clean --if-exists \
  | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"

# 2. Arsip volume storage
docker run --rm --volumes-from "$(docker compose ps -q storage)" \
  -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/storage-$STAMP.tar.gz" /var/lib/storage

# 3. Retensi: keep 7 dump DB + 4 arsip storage terakhir
ls -1t "$BACKUP_DIR"/db-*.sql.gz      | tail -n +8 | xargs -r rm --
ls -1t "$BACKUP_DIR"/storage-*.tar.gz | tail -n +5 | xargs -r rm --

echo "Backup selesai: $BACKUP_DIR/db-$STAMP.sql.gz"
```

- [ ] **Step 2: Tulis `scripts/restore.sh`**

```bash
#!/usr/bin/env bash
# Restore database dari file backup .sql.gz
# Pakai: scripts/restore.sh /opt/backups/db-XXXX.sql.gz
set -euo pipefail
[ $# -eq 1 ] || { echo "Pakai: $0 <file.sql.gz>"; exit 1; }
FILE=$1
[ -f "$FILE" ] || { echo "File tidak ada: $FILE"; exit 1; }

read -rp "Ini akan MENIMPA database sekarang. Lanjut? [ketik YA] " ans
[ "$ans" = "YA" ] || exit 1

gunzip -c "$FILE" | docker compose exec -T db psql -U postgres -d postgres
echo "Restore selesai."
```

- [ ] **Step 3: Verifikasi sintaks**

Run: `bash -n scripts/backup.sh && bash -n scripts/restore.sh && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add scripts/backup.sh scripts/restore.sh
git commit -m "feat(ops): nightly backup + restore scripts with retention"
```

---

### Task 4: CI/CD — quality gate + auto-deploy via self-hosted runner

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `scripts/deploy.sh`

**Interfaces:**
- Consumes: runner self-hosted label `vps` di VPS (install di Task 7), repo di `/opt/demoofficeless`, `.env` sudah ada di VPS.
- Produces: PR = lint+tsc+build; push main = deploy otomatis dengan pre-deploy backup, healthcheck, rollback otomatis.

- [ ] **Step 1: Tulis `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run build
        env:
          # nilai dummy — hanya agar build tidak gagal krn NEXT_PUBLIC_* kosong
          NEXT_PUBLIC_SUPABASE_URL: https://dummy.supabase.co
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: dummy

  deploy:
    needs: quality
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: [self-hosted, vps]
    steps:
      - name: Deploy ke VPS
        run: /opt/demoofficeless/scripts/deploy.sh "$GITHUB_SHA"
```

- [ ] **Step 2: Tulis `scripts/deploy.sh`**

```bash
#!/usr/bin/env bash
# Deploy di VPS oleh self-hosted runner.
# Pakai: deploy.sh <git-sha>   (rollback otomatis bila healthcheck gagal)
set -euo pipefail

APP_DIR=/opt/demoofficeless
cd "$APP_DIR"

SHA=${1:?Pakai: deploy.sh <git-sha>}
TAG=git-${SHA:0:12}
PREV_TAG=$(cat .deploy-current 2>/dev/null || echo "")
HEALTH_URL="https://${APP_DOMAIN:?APP_DOMAIN belum diset di .env}/login"

echo "== Deploy $TAG (sebelumnya: ${PREV_TAG:-none}) =="

# 1. Sinkronkan kode
git fetch --quiet origin
git reset --hard "$SHA"

# 2. Build image baru (tag = sha)
docker compose build --build-arg BUILD_SHA="$TAG" app
docker tag demoofficeless-app:latest "demoofficeless-app:$TAG"

# 3. Pre-deploy backup (best-effort, tidak blok deploy bila gagal)
./scripts/backup.sh || echo "WARN: pre-deploy backup gagal — lanjut"

# 4. Up + tunggu healthcheck (compose healthcheck, max ~60s)
docker compose up -d --wait app

# 5. Verify HTTP
sleep 3
if ! curl -fsS "$HEALTH_URL" > /dev/null; then
  echo "!! Healthcheck gagal — rollback ke ${PREV_TAG:-tidak ada}"
  if [ -n "$PREV_TAG" ]; then
    git reset --hard "$(echo "$PREV_TAG" | sed 's/^git-//')"
    docker compose up -d --wait app
  fi
  exit 1
fi

# 6. Catat tag aktif + prune image lama (keep 5)
echo "$TAG" > .deploy-current
docker images --format '{{.Repository}}:{{.Tag}}' demoofficeless-app \
  | grep ':git-' | tail -n +6 | xargs -r docker rmi || true

echo "== Deploy $TAG OK =="
```

Catatan: `image: demoofficeless-app:latest` sudah dideklarasikan di compose (Task 1) sehingga `docker compose build app` otomatis men-tag `latest`, lalu di-tag ulang ke `$TAG` (sha) oleh skrip ini.

- [ ] **Step 3: Verifikasi sintaks**

Run: `bash -n scripts/deploy.sh && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml scripts/deploy.sh docker-compose.yml
git commit -m "feat(ci): quality gate on PR + auto-deploy on push main (self-hosted runner, healthcheck, rollback)"
```

---

### Task 5: Migrasi data — key generator + storage copy + redis internal

**Files:**
- Create: `scripts/migrate/generate-keys.mjs`
- Create: `scripts/migrate/copy-storage.mjs`
- Modify: `src/lib/cache.ts` (satu-satunya perubahan kode: dukung Redis internal)

**Interfaces:**
- Produces: `generate-keys.mjs` (stdout: ANON_KEY & SERVICE_ROLE_KEY JWT HS256); `copy-storage.mjs` (butuh env `CLOUD_URL`, `CLOUD_SERVICE_KEY`, `TARGET_URL`, `TARGET_SERVICE_KEY`; bucket `dataperkom`); `cache.ts` membaca `REDIS_INTERNAL_URL` (protokol `redis://`, pakai `ioredis`? TIDAK — pakai `redis` package? Hindari dep baru: gunakan `@upstash/redis` hanya bila URL REST; untuk internal gunakan... ) — LIHAT keputusan di bawah.

Keputusan cache (di spec §2 redis internal): pakai package `redis` (node-redis v4, satu dep baru kecil, already-maintained). `cached<T>()` API tidak berubah — hanya transport yang berganti bila `REDIS_INTERNAL_URL` diset; fallback Upstash bila `UPSTASH_REDIS_REST_URL` diset; selain itu no-cache. Ini menjaga dev tetap jalan tanpa Redis.

- [ ] **Step 1: Tulis `scripts/migrate/generate-keys.mjs`**

```js
#!/usr/bin/env node
// Generate anon & service_role key JWT (HS256) untuk self-host Supabase.
// Pakai: node scripts/migrate/generate-keys.mjs <jwt-secret>
import { createHmac } from "node:crypto";

const secret = process.argv[2];
if (!secret) {
  console.error("Pakai: node scripts/migrate/generate-keys.mjs <jwt-secret>");
  process.exit(1);
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

const claims = { iss: "supabase", iat: 1609459200, exp: 1893456000 };
console.log("ANON_KEY=" + sign({ ...claims, role: "anon" }));
console.log("SERVICE_ROLE_KEY=" + sign({ ...claims, role: "service_role" }));
```

- [ ] **Step 2: Tulis `scripts/migrate/copy-storage.mjs`**

```js
#!/usr/bin/env node
// Copy semua objek bucket dataperkom dari Supabase cloud ke self-host.
// Env: CLOUD_URL, CLOUD_SERVICE_KEY, TARGET_URL, TARGET_SERVICE_KEY
const BUCKET = "dataperkom";

const env = (k) => {
  if (!process.env[k]) throw new Error(`Env ${k} wajib diset`);
  return process.env[k];
};

const cloud = { base: env("CLOUD_URL"), key: env("CLOUD_SERVICE_KEY") };
const target = { base: env("TARGET_URL"), key: env("TARGET_SERVICE_KEY") };

async function listPrefix(prefix = "") {
  const res = await fetch(`${cloud.base}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { apikey: cloud.key, Authorization: `Bearer ${cloud.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } }),
  });
  if (!res.ok) throw new Error(`list gagal (${res.status}): ${await res.text()}`);
  return res.json();
}

async function walk(prefix, files) {
  for (const item of await listPrefix(prefix)) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) await walk(path, files); // folder
    else files.push(path);
  }
}

async function main() {
  const files = [];
  await walk("", files);
  console.log(`Ditemukan ${files.length} objek`);
  let ok = 0, fail = 0;
  for (const path of files) {
    const dl = await fetch(`${cloud.base}/storage/v1/object/${BUCKET}/${path}`, {
      headers: { apikey: cloud.key, Authorization: `Bearer ${cloud.key}` },
    });
    if (!dl.ok) { console.error(`DOWNLOAD GAGAL ${path}: ${dl.status}`); fail++; continue; }
    const buf = Buffer.from(await dl.arrayBuffer());
    const up = await fetch(`${target.base}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: target.key, Authorization: `Bearer ${target.key}`,
        "Content-Type": "application/octet-stream", "x-upsert": "true",
      },
      body: buf,
    });
    if (up.ok) { ok++; } else { console.error(`UPLOAD GAGAL ${path}: ${up.status} ${await up.text()}`); fail++; }
  }
  console.log(`Selesai: ${ok} sukses, ${fail} gagal`);
  if (fail > 0) process.exit(1);
}

main();
```

- [ ] **Step 3: Ubah `src/lib/cache.ts`** — transport internal redis:// via package `redis`, fallback Upstash REST, fallback no-cache; API `cached()/bump()/version()` tetap.

```bash
npm install redis
```

```ts
import { Redis } from "@upstash/redis";
import { createClient } from "redis";

/**
 * Cache bersama untuk semua route API.
 * Prioritas: REDIS_INTERNAL_URL (VPS, protokol redis://) →
 * UPSTASH_REDIS_REST_URL/TOKEN (cloud) → tanpa cache (dev tetap jalan).
 */
const internalUrl = process.env.REDIS_INTERNAL_URL;
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const internal = internalUrl ? createClient({ url: internalUrl }) : null;
internal?.on("error", (e) => console.error("Redis internal error:", e));
internal?.connect().catch(() => console.error("Redis internal connect gagal"));

const upstash =
  upstashUrl && upstashToken
    ? new Redis({ url: upstashUrl, token: upstashToken })
    : null;

type MinimalRedis = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, opts?: { EX?: number }): Promise<unknown>;
  incr(key: string): Promise<number>;
};

const client: MinimalRedis | null = (internal ?? upstash) as MinimalRedis | null;

const ttlOpt = (ttlSeconds: number) =>
  internal ? { EX: ttlSeconds } : ({ ex: ttlSeconds } as { EX?: number });

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  if (!client) return fn();
  try {
    const hit = await client.get(key);
    if (hit !== null) return JSON.parse(hit as string) as T;
  } catch (e) {
    console.error("Redis get gagal, lanjut tanpa cache:", e);
  }
  const value = await fn();
  try {
    await client.set(key, JSON.stringify(value), ttlOpt(ttlSeconds));
  } catch (e) {
    console.error("Redis set gagal:", e);
  }
  return value;
}

/** Naikkan versi — semua cache dengan versi lama langsung tidak terpakai. */
export async function bump(versionKey: string): Promise<void> {
  if (!client) return;
  try {
    await client.incr(versionKey);
  } catch (e) {
    console.error("Redis incr gagal:", e);
  }
}

export async function version(versionKey: string): Promise<number> {
  if (!client) return 0;
  try {
    const v = await client.get(versionKey);
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

export const EMPLOYEES_VER = "employees:ver";
```

Catatan: nilai cache kini di-JSON.stringify (upstash driver sebelumnya menyimpan objek native). Bentuk data sama saat dibaca balik.

- [ ] **Step 4: Verifikasi**

Run: `node --check scripts/migrate/generate-keys.mjs && node --check scripts/migrate/copy-storage.mjs && npm run lint && npx tsc --noEmit && npm run build`
Expected: semua lolos (build dengan dummy env NEXT_PUBLIC).

Sanity test generator (nilai acak, bukan secret cloud):
Run: `node scripts/migrate/generate-keys.mjs testsecret | head -2`
Expected: dua baris `ANON_KEY=eyJ...` / `SERVICE_ROLE_KEY=eyJ...`

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate/ src/lib/cache.ts package.json package-lock.json
git commit -m "feat(migrate): key generator + storage copier; cache supports internal redis"
```

---

### Task 6: DEPLOY.md — runbook lengkap VPS

**Files:**
- Modify: `DEPLOY.md` (replace seluruh isi)

**Interfaces:**
- Consumes: semua artefak Task 1–5.
- Produces: instruksi operasional satu halaman: provisioning → DNS → Caddy+TLS → runner → restore data → cutover → rollback → operasional harian.

- [ ] **Step 1: Tulis `DEPLOY.md` baru** — kerangka isi WAJIB (lengkapi dengan teks utuh saat implementasi, jangan placeholder):

```markdown
# Deploy & Operasional VPS (Docker, self-host Supabase)

## 0. Prasyarat
- VPS Debian, akses SSH via FortiVPN, DNS A record APP_DOMAIN & SB_DOMAIN → IP publik kantor
- FortiGate: forward 80+443 → IP VPS. SELAIN ITU TIDAK ADA.

## 1. Provisioning (sekali)
(perintah: apt update; apt install -y docker.io docker-compose-plugin ufw;
 ufw allow 22,80,443; ufw enable;
 sed SSH: PasswordAuthentication no, PermitRootLogin no;
 deploy user + /opt/demoofficeless clone; cp .env.vps.example → .env, isi nilai, chmod 600;
 docker compose up -d — Caddy otomatis urus TLS saat DNS sudah mengarah)

## 2. Migrasi data dari Supabase cloud
(dump via docker run postgres:17-alpine pg_dump "connection-string-cloud" > dump.sql;
 gunzip pipeline restore: cat dump.sql | docker compose exec -T db psql -U postgres;
 node scripts/migrate/generate-keys.mjs $JWT_SECRET → isi .env ANON/SERVICE;
 export CLOUD_URL=... TARGET_URL=https://$SB_DOMAIN → node scripts/migrate/copy-storage.mjs;
 verifikasi: curl https://SB_DOMAIN/rest/v1/ dengan anon key → 200/401-not-500)

## 3. GitHub Actions self-hosted runner
(buat user 'runner'; ikuti Settings → Actions → Runners → New self-hosted runner (linux x64);
 saat config: --labels vps; jalankan sebagai service systemd;
 pastikan runner user punya akses docker: usermod -aG docker runner)

## 4. Backup harian (cron)
(crontab -e: `15 2 * * * cd /opt/demoofficeless && ./scripts/backup.sh >> /var/log/backup.log 2>&1`)

## 5. Deploy & rollback harian
(otomatis via push main; manual: cd /opt/demoofficeless && git pull && docker compose up -d --build;
 rollback: git checkout <tag> && docker compose up -d --wait)

## 6. Cutover dari Vercel/Supabase cloud
(off-hours; freeze write; final dump+restore; switch DNS; pantau; +7 hari decommission cloud
 setelah ekspor arsip final)

## 7. Troubleshooting cepat
(docker compose ps / logs --tail=50 svc; restore.sh; docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile)
```

Tulis semua bagian dengan perintah lengkap siap salin — tanpa `(命令...)` ringkas di atas (itu kerangka untuk penulis plan, bukan isi akhir).

- [ ] **Step 2: Commit**

```bash
git add DEPLOY.md
git commit -m "docs(ops): full VPS runbook — provisioning, migration, runner, backup, cutover"
```

---

### Task 7: Provisioning VPS (eksekusi runbook — di VPS via FortiVPN)

**Files:** tidak ada perubahan repo. Eksekusi DEPLOY.md §0–§3 di VPS.

- [ ] Step 1: Install paket + UFW + SSH hardening (DEPLOY.md §1) — verify: `ufw status` hanya 22/80/443; `ssh -o PreferredAuthentications=password` ditolak.
- [ ] Step 2: Clone repo ke `/opt/demoofficeless`, buat `.env`, `docker compose up -d` — verify: `docker compose ps` semua healthy; log caddy menunjukkan sertifikat terbit.
- [ ] Step 3: Verifikasi TLS & routing — verify: `curl -I https://APP_DOMAIN/login` → 200; `curl -I https://SB_DOMAIN/rest/v1/` → bukan 5xx (401 dari PostgREST = normal tanpa apikey).
- [ ] Step 4: Install self-hosted runner label `vps` + grup docker — verify: runner "Idle" di GitHub Settings; test push commit kecil → job deploy muncul.

### Task 8: Migrasi data & verifikasi (di VPS)

- [ ] Step 1: `pg_dump` cloud + restore (DEPLOY.md §2) — verify: `docker compose exec db psql -U postgres -c '\dt'` menampilkan tabel public + auth.users ada baris.
- [ ] Step 2: Generate keys, update `.env`, `docker compose up -d --build` (NEXT_PUBLIC di-bake ulang) — verify: login di browser dengan akun lama BERHASIL tanpa reset password.
- [ ] Step 3: `copy-storage.mjs` — verify: buka satu claim managed-service lama, PDF kebuka via URL publik baru.
- [ ] Step 4: Checklist verifikasi spec §9 (login, claim detail, upload baru, WA test, inventory scan).

### Task 9: Cutover DNS + decommission

- [ ] Step 1: Off-hours — final dump delta + restore; pastikan tidak ada write (cek `pg_stat_activity` cloud).
- [ ] Step 2: Switch DNS A record → IP kantor; monitor error log 1x24 jam.
- [ ] Step 3: H+7 stabil → ekspor arsip final (dump + storage tar) → pause/delete project Vercel & Supabase cloud.
