-- ============================================================
-- 009: Storage bucket dataperkom (sebelumnya dibuat manual di
-- project lama — hilang saat ganti project Supabase)
-- ============================================================

-- Public sesuai perilaku lama: claims/managed-service memakai getPublicUrl
-- ponytail: PDF statement ikut public di bucket ini — pisahkan bucket private kalau makin sensitif
INSERT INTO storage.buckets (id, name, public)
VALUES ('dataperkom', 'dataperkom', true)
ON CONFLICT (id) DO NOTHING;

-- Upload statement jalan via cookie-based client (role authenticated),
-- bukan service role → butuh policy insert/select
CREATE POLICY "authenticated can upload to dataperkom"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dataperkom');

CREATE POLICY "authenticated can read dataperkom"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dataperkom');
