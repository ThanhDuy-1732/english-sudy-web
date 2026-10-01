-- exam_attempts, mistake_log, speaking_sessions, writing_submissions were created
-- without RLS (unlike learned_words/custom_topics/daily_challenges/grammar_topics/
-- unified_mistakes). Bring them in line with the sync_key_rls pattern.

ALTER TABLE exam_attempts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mistake_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaking_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE writing_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_key_rls ON exam_attempts;
CREATE POLICY sync_key_rls ON exam_attempts
  FOR ALL
  USING      (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'))
  WITH CHECK (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'));

DROP POLICY IF EXISTS sync_key_rls ON mistake_log;
CREATE POLICY sync_key_rls ON mistake_log
  FOR ALL
  USING      (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'))
  WITH CHECK (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'));

DROP POLICY IF EXISTS sync_key_rls ON speaking_sessions;
CREATE POLICY sync_key_rls ON speaking_sessions
  FOR ALL
  USING      (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'))
  WITH CHECK (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'));

DROP POLICY IF EXISTS sync_key_rls ON writing_submissions;
CREATE POLICY sync_key_rls ON writing_submissions
  FOR ALL
  USING      (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'))
  WITH CHECK (sync_key::text = (current_setting('request.headers', true)::json ->> 'x-sync-key'));

-- exam_items is an intentionally shared, non-per-user content bank (no sync_key
-- column) and is left without RLS.
