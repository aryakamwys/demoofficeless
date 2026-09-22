-- Tabel asset Perkom untuk modul Inventory (scan barcode).
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  barcode text not null unique,
  name text not null default '',
  location text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assets enable row level security;

-- Tidak ada policy publik — hanya service role (API server) yang boleh akses.
create index if not exists assets_barcode_idx on public.assets (barcode);
