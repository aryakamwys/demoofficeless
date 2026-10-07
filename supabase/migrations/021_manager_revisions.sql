-- Revisi manager: kategori employee (engineer/sales), paraf manager di
-- request dokumen, dan bukti transfer otomatis di refund.
-- Eksekusi di VPS (container db) seperti migrasi sebelumnya.

-- 1. Kategori besar employee — menentukan template chat WA yang dipakai
--    (engineer = lengkap dengan command ticket; sales = sederhana).
alter table employees
  add column if not exists category text not null default 'ENGINEER'
    check (category in ('ENGINEER','SALES'));

-- 2. Paraf/persetujuan manager (base64 PNG dari signature pad) pada
--    request dokumen — bukti manager mengetahui & menyetujui kebutuhan.
alter table document_requests
  add column if not exists manager_signature text;

-- 3. Bukti transfer otomatis dari WhatsApp: gambar yang dikirim karyawan
--    disimpan ke storage, lalu divalidasi HR dari web.
alter table trip_refunds
  add column if not exists proof_path text,
  add column if not exists proof_validated boolean not null default false,
  add column if not exists proof_reject_reason text,
  add column if not exists proof_received_at timestamptz;
