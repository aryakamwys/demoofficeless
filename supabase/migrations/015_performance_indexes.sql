-- ============================================================
-- 015: Index performa — filter/join/sort klaim jadi index scan
-- (restore parsial pg_dump sebelumnya berpotensi meninggalkan tabel
--  tanpa index; semua idempotent IF NOT EXISTS)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_claims_status       ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_period       ON claims(period);
CREATE INDEX IF NOT EXISTS idx_claims_upload_id    ON claims(upload_id);
CREATE INDEX IF NOT EXISTS idx_claims_employee_id  ON claims(employee_id);
CREATE INDEX IF NOT EXISTS idx_claims_manager_id   ON claims(manager_id);
CREATE INDEX IF NOT EXISTS idx_claims_hr_id        ON claims(hr_id);
CREATE INDEX IF NOT EXISTS idx_claims_updated_at   ON claims(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_wa_sent_at   ON claims(wa_sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_trips_claim_id      ON trips(claim_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_comments_claim_id   ON comments(claim_id, created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_claim ON whatsapp_logs(claim_id, created_at);

CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_hr_id      ON employees(hr_id);
