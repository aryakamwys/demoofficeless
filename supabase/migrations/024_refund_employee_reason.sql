-- Alur penggantian v2: HR menandai trip "tidak sesuai" → KARYAWAN dulu
-- yang diminta alasan. Kolom ini menyimpan justifikasi karyawan yang dikirim
-- ke manager: setujui = perjalanan sah (paraf manager tercatat di trip,
-- penggantian batal); tolak = karyawan wajib transfer ke rekening kantor.

alter table trip_refunds add column if not exists employee_reason text;
alter table trip_refunds add column if not exists employee_explained_at timestamptz;
