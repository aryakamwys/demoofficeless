#!/usr/bin/env bash
# Deploy di VPS oleh self-hosted runner.
# Pakai: deploy.sh <git-sha>
# Rollback otomatis bila container/healthcheck gagal: image per-commit
# (demoofficeless-app:git-<sha12>) yang tersimpan di-tag balik ke `latest`
# lalu container di-force-recreate — tanpa rebuild, jadi benar-benar kembali
# ke image yang berjalan sebelumnya (bukan rebuild ulang kode lama).
set -euo pipefail

APP_DIR=/opt/demoofficeless
cd "$APP_DIR"

# .env milik compose; source agar skrip ini juga punya APP_DOMAIN dkk
set -a
. ./.env
set +a

SHA=${1:?Pakai: deploy.sh <git-sha>}
TAG=git-${SHA:0:12}
PREV_TAG=$(cat .deploy-current 2>/dev/null || echo "")
HEALTH_URL="http://127.0.0.1:3000/login"

echo "== Deploy $TAG (sebelumnya: ${PREV_TAG:-none}) =="

# 1. Sinkronkan kode
git fetch --quiet origin
git reset --hard "$SHA"

# 1.5 Tautan tombol WA butuh NEXT_PUBLIC_APP_URL (di-bake saat build, jadi
#     harus ada SEBELUM build). SELALU dijaga = https://APP_DOMAIN — dulu
#     di-derive dari SB_DOMAIN sehingga link di pesan WA menunjuk ke
#     subdomain supabase (jalan, tapi tampak mencurigakan bagi penerima).
if [ -n "${APP_DOMAIN:-}" ]; then
  if grep -q '^NEXT_PUBLIC_APP_URL=' .env; then
    sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://${APP_DOMAIN}|" .env
  else
    echo "NEXT_PUBLIC_APP_URL=https://${APP_DOMAIN}" >> .env
  fi
  echo "== .env: NEXT_PUBLIC_APP_URL=https://${APP_DOMAIN} =="
fi

# 2. Build image baru (tag = sha)
docker compose build app
docker tag demoofficeless-app:latest "demoofficeless-app:$TAG"

# 3. Pre-deploy backup (best-effort, tidak blok deploy bila gagal)
./scripts/backup.sh || echo "WARN: pre-deploy backup gagal — lanjut"

# 3.5 Migrasi database belum tercatat (terlacak di schema_migrations,
#     idempoten). Gagal migrasi = deploy berhenti SEBELUM app diganti —
#     app lama tetap aman walau skema sudah berubah (migrasi additive).
./scripts/migrate.sh

# 4. Up + tunggu healthcheck (compose healthcheck, max ~60s).
#    Dibungkus if!: tanpa ini `set -e` menghentikan skrip saat container
#    tidak pernah healthy, sehingga blok rollback tidak pernah jalan.
deploy_ok=true
if ! docker compose up -d --wait app; then
  deploy_ok=false
  echo "!! Container app tidak healthy"
fi

# 5. Verify HTTP — loopback publish (127.0.0.1:3000, compose): tanpa
#    dependensi DNS/sertifikat, jadi valid pra- maupun pasca-cutover.
if $deploy_ok; then
  sleep 3
  curl -fsS --max-time 15 "$HEALTH_URL" > /dev/null || deploy_ok=false
fi

if ! $deploy_ok; then
  echo "!! Deploy gagal — rollback ke ${PREV_TAG:-tidak ada}"
  if [ -n "$PREV_TAG" ]; then
    git reset --hard "${PREV_TAG#git-}"
    docker tag "demoofficeless-app:$PREV_TAG" demoofficeless-app:latest
    docker compose up -d --wait --force-recreate app
  else
    echo "!! Deploy pertama (tidak ada image sebelumnya) — tidak ada rollback"
  fi
  exit 1
fi

# 6. Catat tag aktif + prune image lama (keep 5)
echo "$TAG" > .deploy-current
docker images --format '{{.Repository}}:{{.Tag}}' demoofficeless-app \
  | grep ':git-' | tail -n +6 | xargs -r docker rmi || true

echo "== Deploy $TAG OK =="
