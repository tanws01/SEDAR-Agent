create table if not exists sedar_users (
  id text primary key,
  goal jsonb not null default '{}'::jsonb,
  meals jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists sedar_users_updated_at_idx on sedar_users(updated_at desc);
