#!/usr/bin/env bash
# Migrasi database otomatis — dipanggil deploy.sh SEBELUM app dinyalakan,
# jadi kode baru tidak pernah jalan tanpa skema yang dibutuhkannya.
# File yang sudah diterapkan tercatat di tabel schema_migrations dan tidak
# diulang. DB existing (001–012 dulu dijalankan manual) ditandai sudah
# saat bootstrap — migrasi sendiri idempoten, jadi aman bila sebagian
# pernah dijalankan manual.
set -euo pipefail

cd "$(dirname "$0")/.."

PSQL="docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1"

# 1. Tabel penanda migrasi
$PSQL -q -c "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());"

# 2. Bootstrap DB existing: tabel trips sudah ada = 001–012 pernah
#    dijalankan manual sebelum tracker ada — tandai tanpa menjalankan ulang
#    (001 membuat tabel tanpa IF NOT EXISTS, jalankan ulang = error).
has_trips=$($PSQL -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='trips'")
marked=$($PSQL -tAc "SELECT count(*) FROM schema_migrations")
if [ "$has_trips" = "1" ] && [ "$marked" = "0" ]; then
  echo "== Bootstrap: tandai 001–012 sudah diterapkan (DB existing) =="
  for f in supabase/migrations/*.sql; do
    case "$(basename "$f")" in
      001_*|002_*|003_*|004_*|005_*|006_*|007_*|008_*|009_*|010_*|011_*|012_*)
        $PSQL -q -c "INSERT INTO schema_migrations (filename) VALUES ('$(basename "$f")') ON CONFLICT DO NOTHING;"
        ;;
    esac
  done
fi

# 3. Terapkan file yang belum tercatat (glob bash sudah urut nama file)
for f in supabase/migrations/*.sql; do
  name=$(basename "$f")
  if [ "$($PSQL -tAc "SELECT count(*) FROM schema_migrations WHERE filename='$name'")" != "0" ]; then
    continue
  fi
  echo "== Migrasi: $name =="
  $PSQL -q < "$f"
  $PSQL -q -c "INSERT INTO schema_migrations (filename) VALUES ('$name');"
done

echo "== Migrasi database OK =="
