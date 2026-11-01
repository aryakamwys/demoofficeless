-- ============================================================
-- 029: Backstop DB untuk race penandaan ganda pada trip_refunds.
-- Cek-then-insert di API bisa lolos untuk dua HR yang menandai trip
-- yang sama bersamaan → dua baris penggantian AKTIF untuk satu trip
-- (karyawan ter-tagih dua kali, klaim terjebak di NEED_REVIEW).
-- Sejalan dengan 017: hanya status aktif yang dibatasi, riwayat
-- (CONFIRMED/CANCELLED) tetap leluasa.
-- ============================================================

-- 1) Bersihkan duplikat aktif yang sudah terlanjur: sisakan SATU baris
--    aktif per (claim_id, trip_no) — yang dipertahankan tanda pertama
--    (requested_at paling awal).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY claim_id, trip_no
           ORDER BY requested_at ASC
         ) AS rn
  FROM trip_refunds
  WHERE status IN ('REQUESTED', 'CLAIMED')
)
DELETE FROM trip_refunds WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Kunci tingkat database: maksimal satu penggantian aktif per trip
--    per klaim (kode 23505 ditangani API sebagai "Trip ini sudah ditandai").
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_refund_per_trip
  ON trip_refunds(claim_id, trip_no)
  WHERE status IN ('REQUESTED', 'CLAIMED');
