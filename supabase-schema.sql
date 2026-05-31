create table if not exists public.line_layouts (
  line text primary key,
  line_name text not null,
  machines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pm_records (
  line text primary key references public.line_layouts(line) on delete cascade,
  equipment_set text not null default '',
  last_pm_date date,
  next_pm_date date,
  owner text not null default 'Maintenance Team',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_history (
  id bigint primary key,
  pm_date date not null,
  line text not null references public.line_layouts(line) on delete cascade,
  equipment_set text not null default '',
  problem text not null default '',
  technician text not null default 'Maintenance Team',
  status text not null default 'Done',
  downtime integer not null default 0,
  priority text not null default 'Medium',
  created_at timestamptz not null default now()
);

alter table public.line_layouts enable row level security;
alter table public.pm_records enable row level security;
alter table public.maintenance_history enable row level security;

drop policy if exists "Allow public read line layouts" on public.line_layouts;
drop policy if exists "Allow public write line layouts" on public.line_layouts;
drop policy if exists "Allow public read pm records" on public.pm_records;
drop policy if exists "Allow public write pm records" on public.pm_records;
drop policy if exists "Allow public read maintenance history" on public.maintenance_history;
drop policy if exists "Allow public write maintenance history" on public.maintenance_history;

create policy "Allow public read line layouts"
on public.line_layouts for select
to anon
using (true);

create policy "Allow public write line layouts"
on public.line_layouts for all
to anon
using (true)
with check (true);

create policy "Allow public read pm records"
on public.pm_records for select
to anon
using (true);

create policy "Allow public write pm records"
on public.pm_records for all
to anon
using (true)
with check (true);

create policy "Allow public read maintenance history"
on public.maintenance_history for select
to anon
using (true);

create policy "Allow public write maintenance history"
on public.maintenance_history for all
to anon
using (true)
with check (true);
