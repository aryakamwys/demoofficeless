-- ============================================================
-- 011: Perbaikan schema db self-host.
-- Restore dump dari cloud berhenti tengah jalan (runbook §2.2):
-- tabel bagian akhir, kolom tambahan, dan policy RLS tidak ikut
-- pindah. Semua statement idempoten — aman dijalankan berulang.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------- Tabel dasar (yang sudah ada tidak tersentuh) -------
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_number VARCHAR(50) UNIQUE NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  department VARCHAR(100) NOT NULL DEFAULT '',
  phone_number VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employees_number ON employees(employee_number);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);

-- ------- Constraint yang hilang: pg_dump menaruh ADD CONSTRAINT di akhir,
-- restore yang mati tengah jalan menyisakan tabel TANPA primary key -------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_pkey') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_number_key') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_number_key UNIQUE (employee_number);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period VARCHAR(20) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(10) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'UPLOADED',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claims (
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
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_employee ON claims(employee_id);
CREATE INDEX IF NOT EXISTS idx_claims_period ON claims(period);

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  trip_date TIMESTAMPTZ NOT NULL,
  booking_id VARCHAR(100) NOT NULL DEFAULT '',
  pickup TEXT NOT NULL DEFAULT '',
  dropoff TEXT NOT NULL DEFAULT '',
  fare NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trips_claim ON trips(claim_id);

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_claim ON comments(claim_id);

CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_logs_claim ON whatsapp_logs(claim_id);

-- ------- Tabel modul (dari 005/006/007) -------
CREATE TABLE IF NOT EXISTS public.signatures (
  employee_id UUID PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  signature TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid primary key default gen_random_uuid(),
  barcode text not null unique,
  name text not null default '',
  location text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS assets_barcode_idx ON public.assets (barcode);

CREATE TABLE IF NOT EXISTS managed_service_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id VARCHAR NOT NULL,
  ticket_title VARCHAR,
  customer_name VARCHAR,
  location VARCHAR,
  amount NUMERIC NOT NULL,
  storage_path TEXT,
  status VARCHAR DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE managed_service_claims ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE managed_service_claims DROP COLUMN IF EXISTS file_url;

-- ------- Kolom tambahan (dari 002/003/004/008) -------
ALTER TABLE trips ADD COLUMN IF NOT EXISTS service_type VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS employee_group VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS cost_code VARCHAR(255) NOT NULL DEFAULT '';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE'
  CHECK (role IN ('EMPLOYEE', 'MANAGER', 'HR'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hr_id UUID REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE claims ADD COLUMN IF NOT EXISTS manager_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
  CHECK (manager_status IN ('PENDING', 'APPROVED', 'REJECTED'));
ALTER TABLE claims ADD COLUMN IF NOT EXISTS hr_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
  CHECK (hr_status IN ('PENDING', 'APPROVED', 'REJECTED'));
ALTER TABLE claims ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS hr_id UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS pending_wa_change JSONB DEFAULT NULL;

ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_name VARCHAR(255);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_role VARCHAR(20);

-- ------- RLS + policy (dump bisa kehilangan policy walau tabel ada) -------
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage employees" ON employees;
CREATE POLICY "Authenticated users can manage employees"
  ON employees FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage uploads" ON uploads;
CREATE POLICY "Authenticated users can manage uploads"
  ON uploads FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage claims" ON claims;
CREATE POLICY "Authenticated users can manage claims"
  ON claims FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage trips" ON trips;
CREATE POLICY "Authenticated users can manage trips"
  ON trips FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage comments" ON comments;
CREATE POLICY "Authenticated users can manage comments"
  ON comments FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage whatsapp_logs" ON whatsapp_logs;
CREATE POLICY "Authenticated users can manage whatsapp_logs"
  ON whatsapp_logs FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role can manage claims" ON claims;
CREATE POLICY "Service role can manage claims"
  ON claims FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert comments" ON comments;
CREATE POLICY "Service role can insert comments"
  ON comments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert whatsapp_logs" ON whatsapp_logs;
CREATE POLICY "Service role can insert whatsapp_logs"
  ON whatsapp_logs FOR INSERT WITH CHECK (true);
