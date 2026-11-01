-- ============================================================
-- 027: Merge klaim managed service — constraint, RLS, function.
-- 1) Route merge menulis claims.status = 'MERGED' padahal CHECK
--    constraint (001/011) tidak mengizinkannya → amount sudah
--    terlanjur ditambah, update gagal 500, tiap retry menambah
--    grab total LAGI. Status 'MERGED' kini sah.
-- 2) managed_service_claims satu-satunya tabel tanpa RLS — pasang
--    policy authenticated seperti tabel lain (pola 001/011).
-- 3) Function merge_managed_claim: merge jadi SATU transaksi di
--    Postgres, bukan read-modify-write JS yang bisa lost update.
-- Semua statement idempoten — aman dijalankan berulang.
-- ============================================================

-- ---- 1) CHECK constraint claims.status + 'MERGED' ----
-- Constraint inline tanpa nama di 001/011 → nama default Postgres
-- claims_status_check. Drop+add berpasangan = idempoten.
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_status_check;
ALTER TABLE claims ADD CONSTRAINT claims_status_check
  CHECK (status IN ('PENDING', 'SENT', 'APPROVED', 'NEED_REVIEW', 'UNMATCHED', 'MERGED'));

-- ---- 2) RLS + policy managed_service_claims (pola 011) ----
ALTER TABLE managed_service_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage managed_service_claims" ON managed_service_claims;
CREATE POLICY "Authenticated users can manage managed_service_claims"
  ON managed_service_claims FOR ALL USING (auth.role() = 'authenticated');

-- ---- 3) Merge atomik ----
-- Invoker rights (bukan SECURITY DEFINER) — RLS tetap berlaku,
-- policy authenticated di kedua tabel sudah mengizinkan UPDATE.
CREATE OR REPLACE FUNCTION merge_managed_claim(p_managed uuid, p_grab uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_status VARCHAR(20);
  v_total NUMERIC(12,2);
BEGIN
  -- Kunci baris grab dulu (urutan kunci konsisten = bebas deadlock).
  -- FOR UPDATE + cek status dalam transaksi sama = dobel merge tertahan.
  SELECT status, total_amount
    INTO v_status, v_total
    FROM claims
   WHERE id = p_grab
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'GRAB_NOT_FOUND');
  END IF;

  IF v_status <> 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'GRAB_NOT_PENDING');
  END IF;

  -- amount dijumlah di server di bawah kunci baris — bukan read-modify-write JS.
  UPDATE managed_service_claims
     SET amount = amount + v_total
   WHERE id = p_managed;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'MANAGED_NOT_FOUND');
  END IF;

  UPDATE claims SET status = 'MERGED' WHERE id = p_grab;

  RETURN jsonb_build_object('success', true);
END;
$$;
