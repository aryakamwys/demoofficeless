-- 023: Bersihkan data yatim + pasang FK cascade yang hilang di DB hasil
-- restore dump. Akar masalah sama seperti 019: migration 001/011 memakai
-- CREATE TABLE IF NOT EXISTS, jadi tabel yang sudah ada (hasil dump) tidak
-- pernah mendapat FK-nya — 019 hanya memperbaiki signatures/employees/assets.
-- Efek nyata: hapus upload meninggalkan claims aktif yatim, dan balasan WA
-- terus mencocokkan klaim test lama yang seharusnya sudah terhapus.

-- ==== 1) Baris yatim dari hapus-hapus sebelumnya (anak dulu, baru induk) ====
DELETE FROM whatsapp_logs
 WHERE claim_id IS NOT NULL
   AND claim_id NOT IN (SELECT id FROM claims);

DELETE FROM trip_refunds
 WHERE claim_id NOT IN (SELECT id FROM claims)
    OR (trip_id IS NOT NULL AND trip_id NOT IN (SELECT id FROM trips));

DELETE FROM comments
 WHERE claim_id NOT IN (SELECT id FROM claims);

DELETE FROM trips
 WHERE claim_id NOT IN (SELECT id FROM claims);

DELETE FROM claims
 WHERE upload_id NOT IN (SELECT id FROM uploads);

-- ==== 2) Pasang FK yang hilang (idempoten, gagal = warning bukan abort) ====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'claims'::regclass
      AND conname = 'claims_upload_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE claims ADD CONSTRAINT claims_upload_id_fkey
        FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'claims.upload_id: FK gagal dipasang — periksa manual';
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'trips'::regclass
      AND conname = 'trips_claim_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE trips ADD CONSTRAINT trips_claim_id_fkey
        FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'trips.claim_id: FK gagal dipasang — periksa manual';
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'comments'::regclass
      AND conname = 'comments_claim_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE comments ADD CONSTRAINT comments_claim_id_fkey
        FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'comments.claim_id: FK gagal dipasang — periksa manual';
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'whatsapp_logs'::regclass
      AND conname = 'whatsapp_logs_claim_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE whatsapp_logs ADD CONSTRAINT whatsapp_logs_claim_id_fkey
        FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'whatsapp_logs.claim_id: FK gagal dipasang — periksa manual';
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'trip_refunds'::regclass
      AND conname = 'trip_refunds_claim_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE trip_refunds ADD CONSTRAINT trip_refunds_claim_id_fkey
        FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'trip_refunds.claim_id: FK gagal dipasang — periksa manual';
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'trip_refunds'::regclass
      AND conname = 'trip_refunds_trip_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE trip_refunds ADD CONSTRAINT trip_refunds_trip_id_fkey
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'trip_refunds.trip_id: FK gagal dipasang — periksa manual';
    END;
  END IF;
END $$;
