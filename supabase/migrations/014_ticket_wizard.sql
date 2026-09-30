-- ============================================================
-- 014: Mode isi ticket satu-per-satu via WhatsApp (wizard)
-- claim.ticket_wizard = { queue: [nomor trip belum punya ticket], i: index }
-- null / tidak aktif = tidak sedang dalam mode wizard.
-- ============================================================

ALTER TABLE claims ADD COLUMN IF NOT EXISTS ticket_wizard JSONB;
