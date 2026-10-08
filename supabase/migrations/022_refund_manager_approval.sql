-- Approval manager untuk penggantian trip "tidak sesuai" — tanda dari HR
-- baru diminta ke karyawan SETELAH manager menyetujui (paraf tersimpan
-- otomatis dari tanda tangan manager di data karyawan).
-- NULL = warisan lama / tanpa manager (langsung jalan seperti sebelumnya).

alter table trip_refunds
  add column if not exists manager_status text
    check (manager_status in ('PENDING', 'APPROVED', 'REJECTED'));

alter table trip_refunds add column if not exists manager_signature text;
alter table trip_refunds add column if not exists manager_decided_at timestamptz;
alter table trip_refunds add column if not exists manager_reason text;
