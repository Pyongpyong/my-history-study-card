ALTER TABLE contents ADD COLUMN IF NOT EXISTS era TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS sub_era TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS start_year INTEGER;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS end_year INTEGER;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS taxonomy TEXT;

CREATE TABLE IF NOT EXISTS quiz_tags (
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (quiz_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_contents_era_sub ON contents(era, sub_era);
CREATE INDEX IF NOT EXISTS idx_quiz_tags_tag ON quiz_tags(tag);
