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
