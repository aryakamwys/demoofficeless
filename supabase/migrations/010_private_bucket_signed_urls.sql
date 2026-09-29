-- ============================================================
-- 010: Bucket dataperkom jadi private + path (bukan URL) di DB
-- PDF statement & file tiket tidak lagi bisa dibaca anonymous;
-- akses file via signed URL yang dibuat saat dibaca (API).
-- ============================================================

-- Private (idempotent: bikin baru private, atau flip yang dari 009)
INSERT INTO storage.buckets (id, name, public)
VALUES ('dataperkom', 'dataperkom', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Simpan storage_path; URL ditandatangani saat dibaca
ALTER TABLE managed_service_claims ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Backfill baris lama: ekstrak path dari URL publik yang tersimpan
UPDATE managed_service_claims
SET storage_path = regexp_replace(file_url, '^.*/object/public/dataperkom/', '')
WHERE storage_path IS NULL
  AND file_url LIKE '%/object/public/dataperkom/%';

ALTER TABLE managed_service_claims DROP COLUMN IF EXISTS file_url;
