CREATE TABLE IF NOT EXISTS unified_mistakes (
  sync_key   UUID        NOT NULL,
  id         TEXT        NOT NULL,
  payload    JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sync_key, id)
);
CREATE INDEX IF NOT EXISTS unified_mistakes_user
  ON unified_mistakes (sync_key, updated_at DESC);

ALTER TABLE unified_mistakes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_key_rls ON unified_mistakes;
CREATE POLICY sync_key_rls ON unified_mistakes
  FOR ALL
  USING      (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'))
  WITH CHECK (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'));
