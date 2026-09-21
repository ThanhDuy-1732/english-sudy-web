create table if not exists exam_items (
  id          text primary key,
  exam_type   text not null,
  part        text not null,
  level       int  not null,
  payload     jsonb not null,
  flagged     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists exam_items_lookup
  on exam_items (exam_type, part, level)
  where not flagged;

create table if not exists exam_attempts (
  id          text primary key,
  sync_key    uuid not null,
  exam_type   text not null,
  mode        text not null,
  parts       jsonb not null,
  started_at  timestamptz not null,
  finished_at timestamptz,
  answers     jsonb not null,
  score       jsonb,
  updated_at  timestamptz not null default now()
);
create index if not exists exam_attempts_user
  on exam_attempts (sync_key, started_at desc);

create table if not exists mistake_log (
  id          text primary key,
  sync_key    uuid not null,
  payload     jsonb not null,
  resolved    boolean not null default false,
  updated_at  timestamptz not null default now()
);
create index if not exists mistake_log_user
  on mistake_log (sync_key, resolved);
