-- 019: Pasang kembali constraint yang hilang saat restore dump self-host.
-- Gejala: upsert signatures ON CONFLICT (employee_id) gagal —
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification".
-- Akar masalah: migration 011 memakai CREATE TABLE IF NOT EXISTS, jadi tabel
-- yang sudah ada (hasil dump) tidak pernah mendapat PK/unique-nya kembali —
-- sementara bootstrap menandai 011 sebagai sudah dijalankan.

-- ==== signatures: PK employee_id (dipakai upsert tanda tangan) ====
-- Buang baris rusak (employee kosong / yatim) lalu duplikat (simpan terbaru).
DELETE FROM signatures
WHERE employee_id IS NULL OR employee_id NOT IN (SELECT id FROM employees);

DELETE FROM signatures a
USING signatures b
WHERE a.employee_id = b.employee_id
  AND (b.updated_at > a.updated_at OR (b.updated_at = a.updated_at AND b.ctid < a.ctid));

ALTER TABLE signatures ALTER COLUMN employee_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'signatures'::regclass AND contype = 'p'
  ) THEN
    BEGIN
      ALTER TABLE signatures ADD CONSTRAINT signatures_pkey PRIMARY KEY (employee_id);
    EXCEPTION WHEN others THEN
      RAISE WARNING 'signatures: PK gagal dipasang — periksa data manual';
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'signatures'::regclass AND conname = 'signatures_employee_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE signatures ADD CONSTRAINT signatures_employee_id_fkey
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'signatures: FK ke employees gagal dipasang — periksa manual';
    END;
  END IF;
END $$;

-- ==== employees: PK id + unique employee_number (dipakai import upsert) ====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'employees'::regclass AND contype = 'p'
  ) THEN
    BEGIN
      ALTER TABLE employees ADD CONSTRAINT employees_pkey PRIMARY KEY (id);
    EXCEPTION WHEN others THEN
      RAISE WARNING 'employees: PK gagal dipasang — periksa manual';
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'employees'::regclass AND conname = 'employees_number_key'
  ) THEN
    BEGIN
      ALTER TABLE employees ADD CONSTRAINT employees_number_key UNIQUE (employee_number);
    EXCEPTION WHEN others THEN
      RAISE WARNING 'employees.employee_number: unique gagal dipasang (ada duplikat?) — periksa manual';
    END;
  END IF;
END $$;

-- ==== assets: unique barcode (dipakai upsert inventory/scan) ====
DELETE FROM assets a
USING assets b
WHERE a.barcode = b.barcode
  AND (b.updated_at > a.updated_at OR (b.updated_at = a.updated_at AND b.ctid < a.ctid));

CREATE UNIQUE INDEX IF NOT EXISTS uniq_assets_barcode ON assets(barcode);
