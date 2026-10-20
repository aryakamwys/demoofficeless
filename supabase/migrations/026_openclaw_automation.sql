-- 026: Openclaw automation — jejak event eksekusi (console & campaign).
-- Best-effort: route /api/automation/events tetap jalan walau tabel belum
-- di-apply (fallback localStorage di client).

create table if not exists public.openclaw_events (
  id bigint generated always as identity primary key,
  run_id text not null,
  kind text not null check (kind in ('info','success','warning','error','demo')),
  label text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_openclaw_events_run
  on public.openclaw_events (run_id, created_at);
