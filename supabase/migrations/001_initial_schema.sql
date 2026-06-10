-- ============================================================
-- Perkom Expense Approval Bot — Initial Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------- employees -------
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_number VARCHAR(50) UNIQUE NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  department VARCHAR(100) NOT NULL DEFAULT '',
  phone_number VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_employees_number ON employees(employee_number);
CREATE INDEX idx_employees_active ON employees(is_active);

-- ------- uploads -------
CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period VARCHAR(20) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(10) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'UPLOADED',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------- claims -------
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  period VARCHAR(20) NOT NULL,
  trip_count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SENT', 'APPROVED', 'NEED_REVIEW', 'UNMATCHED')),
  wa_sent BOOLEAN NOT NULL DEFAULT false,
  wa_sent_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_employee ON claims(employee_id);
CREATE INDEX idx_claims_period ON claims(period);

-- ------- trips -------
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  trip_date TIMESTAMPTZ NOT NULL,
  booking_id VARCHAR(100) NOT NULL DEFAULT '',
  pickup TEXT NOT NULL DEFAULT '',
  dropoff TEXT NOT NULL DEFAULT '',
  fare NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trips_claim ON trips(claim_id);

-- ------- comments -------
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_claim ON comments(claim_id);

-- ------- whatsapp_logs -------
CREATE TABLE whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_logs_claim ON whatsapp_logs(claim_id);

-- ------- RLS Policies -------
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (single admin MVP)
CREATE POLICY "Authenticated users can manage employees"
  ON employees FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage uploads"
  ON uploads FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage claims"
  ON claims FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage trips"
  ON trips FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage comments"
  ON comments FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage whatsapp_logs"
  ON whatsapp_logs FOR ALL USING (auth.role() = 'authenticated');

-- Allow service role for webhook (unauthenticated incoming messages)
CREATE POLICY "Service role can manage claims"
  ON claims FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can insert comments"
  ON comments FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can insert whatsapp_logs"
  ON whatsapp_logs FOR INSERT WITH CHECK (true);

-- ------- Updated_at trigger -------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
