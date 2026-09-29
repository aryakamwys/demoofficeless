-- ============================================================
-- 008: Revisi klaim via chat WhatsApp
-- ============================================================

-- Author note revisi (manager/HR/engineer via chat)
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS author_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS author_role VARCHAR(20);

-- State konfirmasi UBAH <no> <nominal>:
-- { trip_id, trip_no, old_fare, new_fare }
-- Disimpan di DB (bukan memori) supaya tahan restart/redeploy
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS pending_wa_change JSONB DEFAULT NULL;
