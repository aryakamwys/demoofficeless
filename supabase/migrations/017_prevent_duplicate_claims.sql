-- ============================================================
-- 017: Cegah klaim ganda per karyawan per periode.
-- Upload ulang statement pernah membuat klaim kedua untuk periode yang
-- sama — dua klaim aktif berarti dua pesan WA dan dua alur approval
-- untuk hal yang sama (membingungkan karyawan maupun approver).
-- ============================================================

-- 1) Bersihkan duplikat yang sudah terlanjur ada: sisakan SATU klaim
--    aktif per (employee_id, period). Yang dipertahankan: yang paling
--    jauh progresnya (pernah dikonfirmasi karyawan), lalu yang terbaru.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY employee_id, period
           ORDER BY (approved_at IS NOT NULL) DESC, created_at DESC
         ) AS rn
  FROM claims
  WHERE employee_id IS NOT NULL
    AND status IN ('PENDING', 'SENT', 'NEED_REVIEW')
)
DELETE FROM claims WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Kunci tingkat database: maksimal satu klaim aktif per karyawan per
--    periode. Klaim APPROVED tidak dibatasi (riwayat tetap leluasa).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_claim_per_period
  ON claims(employee_id, period)
  WHERE employee_id IS NOT NULL
    AND status IN ('PENDING', 'SENT', 'NEED_REVIEW');
