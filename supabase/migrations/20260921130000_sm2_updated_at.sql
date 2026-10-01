-- Add SM-2 SRS fields and updatedAt tracking to learned_words
ALTER TABLE learned_words
  ADD COLUMN IF NOT EXISTS easiness      FLOAT   DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS repetitions   INT     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT now();
