CREATE TABLE IF NOT EXISTS learned_words (
  sync_key        UUID        NOT NULL,
  word            TEXT        NOT NULL,
  meaning         TEXT,
  example         TEXT,
  topic           TEXT,
  learned_at      TIMESTAMPTZ NOT NULL,
  next_review_at  TIMESTAMPTZ,
  review_interval INT         DEFAULT 1,
  mastery         INT         DEFAULT 0,
  synonyms        TEXT[],
  antonyms        TEXT[],
  PRIMARY KEY (sync_key, word)
);

CREATE TABLE IF NOT EXISTS custom_topics (
  sync_key  UUID NOT NULL,
  topic     TEXT NOT NULL,
  PRIMARY KEY (sync_key, topic)
);

CREATE TABLE IF NOT EXISTS daily_challenges (
  sync_key   UUID    NOT NULL,
  date       DATE    NOT NULL,
  words      TEXT[],
  completed  BOOLEAN DEFAULT false,
  PRIMARY KEY (sync_key, date)
);

ALTER TABLE learned_words  DISABLE ROW LEVEL SECURITY;
ALTER TABLE custom_topics  DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges DISABLE ROW LEVEL SECURITY;
