-- ============================================================
-- 012: Custom Access Token Hook — nempel role:authenticated ke
-- setiap token user. GoTrue self-host tidak meng-copy role dari
-- raw_app_meta_data; tanpa hook ini PostgREST/storage menolak
-- dengan `role "" does not exist`.
-- Aktif via docker-compose.override.yml:
--   GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI=
--     pg-functions://postgres/public/custom_access_token_hook
-- ============================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claims jsonb;
begin
  claims := event->'claims';
  claims := jsonb_set(claims, '{role}', to_jsonb('authenticated'::text));
  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook
  to supabase_auth_admin;

grant usage on schema public to supabase_auth_admin;

revoke execute on function public.custom_access_token_hook
  from authenticated, anon, public;
