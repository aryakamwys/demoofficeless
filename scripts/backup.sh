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
