create table if not exists speaking_sessions (
  id          text primary key,
  sync_key    uuid not null,
  mode        text not null,
  payload     jsonb not null,
  overall     numeric,
  created_at  timestamptz not null,
  updated_at  timestamptz not null default now()
);
create index if not exists speaking_user
  on speaking_sessions (sync_key, created_at desc);

create table if not exists writing_submissions (
  id          text primary key,
  sync_key    uuid not null,
  kind        text not null,
  payload     jsonb not null,
  overall     numeric,
  created_at  timestamptz not null,
  updated_at  timestamptz not null default now()
);
create index if not exists writing_user
  on writing_submissions (sync_key, created_at desc);
