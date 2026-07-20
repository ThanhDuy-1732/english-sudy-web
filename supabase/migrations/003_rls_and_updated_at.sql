-- Add updated_at for accurate conflict resolution (learned_at is immutable after creation)
ALTER TABLE learned_words
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_learned_words_updated_at ON learned_words;
CREATE TRIGGER trg_learned_words_updated_at
  BEFORE UPDATE ON learned_words
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable RLS on all tables
ALTER TABLE learned_words    ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_topics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;

-- Each row is only visible/writable when the x-sync-key request header matches
DROP POLICY IF EXISTS sync_key_rls ON learned_words;
CREATE POLICY sync_key_rls ON learned_words
  FOR ALL
  USING      (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'))
  WITH CHECK (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'));

DROP POLICY IF EXISTS sync_key_rls ON custom_topics;
CREATE POLICY sync_key_rls ON custom_topics
  FOR ALL
  USING      (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'))
  WITH CHECK (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'));

DROP POLICY IF EXISTS sync_key_rls ON daily_challenges;
CREATE POLICY sync_key_rls ON daily_challenges
  FOR ALL
  USING      (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'))
  WITH CHECK (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'));
