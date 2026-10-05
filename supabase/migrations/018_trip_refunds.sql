-- 018: Penggantian trip "tidak sesuai" (refund karyawan -> rekening kantor).
-- Trip yang ditandai HR tetap tampil di klaim sampai HR mengonfirmasi uang
-- masuk; setelah itu trip dihapus dari klaim dan total dihitung ulang.
-- Riwayat penggantian tetap tersimpan walau trip sudah terhapus (snapshot).

CREATE TABLE IF NOT EXISTS trip_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  -- trip_id menjadi NULL setelah trip dihapus — snapshot kolom di bawah
  -- yang menjaga riwayat
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  trip_no INT NOT NULL,
  trip_date TIMESTAMPTZ,
  pickup TEXT,
  dropoff TEXT,
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED', -- REQUESTED | CLAIMED | CONFIRMED | CANCELLED
  employee_note TEXT,
  requested_by TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trip_refunds_claim ON trip_refunds(claim_id);
CREATE INDEX IF NOT EXISTS idx_trip_refunds_trip ON trip_refunds(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_refunds_active ON trip_refunds(status)
  WHERE status IN ('REQUESTED', 'CLAIMED');

ALTER TABLE trip_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage trip_refunds"
  ON trip_refunds FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Service role can manage trip_refunds"
  ON trip_refunds FOR ALL USING (true) WITH CHECK (true);

-- Settings key-value sederhana (rekening kantor untuk penggantian, dll.)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage app_settings"
  ON app_settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Service role can manage app_settings"
  ON app_settings FOR ALL USING (true) WITH CHECK (true);
