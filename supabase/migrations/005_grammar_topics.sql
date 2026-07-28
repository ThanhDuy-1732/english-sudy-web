CREATE TABLE IF NOT EXISTS grammar_topics (
  sync_key   UUID        NOT NULL,
  id         TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  rules      JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sync_key, id)
);

ALTER TABLE grammar_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_key_rls ON grammar_topics;
CREATE POLICY sync_key_rls ON grammar_topics
  FOR ALL
  USING      (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'))
  WITH CHECK (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'));
