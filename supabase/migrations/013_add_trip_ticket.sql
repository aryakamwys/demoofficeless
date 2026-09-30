-- ============================================================
-- 013: Bukti ticket EnvGate per trip (kebutuhan HR)
-- HR mengisi ticket_id per baris trip sebagai bukti kerja engineer;
-- opsional (nullable) — lama tetap valid tanpa ticket.
-- ============================================================

ALTER TABLE trips ADD COLUMN IF NOT EXISTS ticket_id VARCHAR(50);
