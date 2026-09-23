#!/usr/bin/env bash
# Deploy di VPS oleh self-hosted runner.
# Pakai: deploy.sh <git-sha>   (rollback otomatis bila healthcheck gagal)
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
HEALTH_URL="https://${APP_DOMAIN:?APP_DOMAIN belum diset di .env}/login"

echo "== Deploy $TAG (sebelumnya: ${PREV_TAG:-none}) =="

# 1. Sinkronkan kode
git fetch --quiet origin
git reset --hard "$SHA"

# 2. Build image baru (tag = sha)
docker compose build app
docker tag demoofficeless-app:latest "demoofficeless-app:$TAG"

# 3. Pre-deploy backup (best-effort, tidak blok deploy bila gagal)
./scripts/backup.sh || echo "WARN: pre-deploy backup gagal — lanjut"

# 4. Up + tunggu healthcheck (compose healthcheck, max ~60s)
docker compose up -d --wait app

# 5. Verify HTTP
sleep 3
if ! curl -fsS --max-time 15 "$HEALTH_URL" > /dev/null; then
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
