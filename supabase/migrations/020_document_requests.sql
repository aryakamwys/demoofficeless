-- Modul Finance: request dokumen (PR/PO/dll) dengan template + approval manager.
-- Eksekusi di VPS (container db) seperti migrasi sebelumnya.

create table if not exists document_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Template awal — tambah/ubah dari halaman Finance (superadmin)
insert into document_templates (code, name) values
  ('PR', 'Purchase Request'),
  ('PO', 'Purchase Order'),
  ('INV', 'Invoice'),
  ('SJ', 'Surat Jalan')
on conflict (code) do nothing;

create table if not exists document_requests (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references document_templates(id),
  title text not null,
  notes text,
  requested_by uuid references employees(id),
  -- Snapshot approver saat diajukan (manager si pengaju) — perubahan relasi
  -- manager setelahnya tidak memindahkan approval yang sedang berjalan.
  approver_id uuid references employees(id),
  status text not null default 'PENDING'
    check (status in ('PENDING','APPROVED','REJECTED','DIPROSES','SELESAI')),
  rejected_reason text,
  approved_at timestamptz,
  processed_at timestamptz,
  completed_at timestamptz,
  -- Hasil dari finance: catatan (mis. nomor PO) + file dokumen jadi (opsional)
  result_notes text,
  result_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_document_requests_status on document_requests(status);
create index if not exists idx_document_requests_requested_by on document_requests(requested_by);
create index if not exists idx_document_requests_approver on document_requests(approver_id);
