-- 028: Pisahkan dua arti status NEED_REVIEW pada klaim.
-- NEED_REVIEW selama ini berarti (a) tahanan penggantian trip "tidak
-- sesuai" atau (b) revisi karyawan yang sedang berjalan. Saat penggantian
-- selesai, releaseClaimIfNoRefunds() melepas SEMUA klaim NEED_REVIEW —
-- termasuk yang sedang direvisi, sehingga revisi aktif tercancel diam-diam
-- dan link approver terpasang ulang lebih awal. Kolom ini menandai revisi
-- berjalan: diisi oleh permintaan revisi Manager/HR ("2 <alasan>") dan
-- dikembalikan false saat karyawan mengajukan ulang (SELESAI).

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS revision_active BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: klaim NEED_REVIEW yang bukti revisinya paling akhir (permintaan
-- revisi terbaru lebih baru daripada pengajuan ulang terakhir karyawan).
-- Klaim tahanan penggantian tanpa revisi berjalan tetap false supaya tetap
-- dilepaskan saat penggantiannya selesai.
UPDATE claims c
SET revision_active = TRUE
WHERE c.status = 'NEED_REVIEW'
  AND c.approved_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM comments m
    WHERE m.claim_id = c.id
      AND m.author_role IN ('MANAGER', 'HR')
      AND m.message LIKE 'Minta revisi%'
      AND m.created_at > COALESCE((
        SELECT MAX(s.created_at) FROM comments s
        WHERE s.claim_id = c.id
          AND s.author_role = 'EMPLOYEE'
          AND s.message LIKE 'Revisi selesai%'
      ), timestamptz '-infinity')
  );
