-- claims.hr_signature dipakai jalur approve HR (paraf otomatis dari ttd
-- tersimpan) tapi kolomnya belum pernah dibuatkan migrasi — update klaim
-- gagal dengan "column does not exist" dan pengirim dibalas "Kendala
-- Sistem" padahal tidak ada yang salah dari sisi mereka.
-- manager_signature ikut dijamin (if not exists) untuk menyembuhkan drift
-- bila restore dump pernah menghilangkan kolom sementara tracker migrasi
-- sudah mencatat 021 jalan.

alter table claims add column if not exists manager_signature text;
alter table claims add column if not exists hr_signature text;
