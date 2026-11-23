-- Monitoring events for /admin. Apply once: psql "$DATABASE_URL" -f db/schema.sql
CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL CHECK (kind IN ('ai', 'page', 'done')),
  name text NOT NULL,
  device text,
  ms integer,
  ok boolean,
  provider text,
  fallback boolean,
  repair boolean
);
CREATE INDEX IF NOT EXISTS events_kind_at ON events (kind, at);

-- /api/providers/unlock attempts per client ('ip:<addr>' or 'ip6:<first 64 bits>'), reset after the window or a right password (src/lib/unlock-limit.ts).
CREATE TABLE IF NOT EXISTS unlock_attempts (
  key text PRIMARY KEY,
  fails integer NOT NULL,
  since timestamptz NOT NULL DEFAULT now()
);
