-- Fix assignment_questions schema to match CreateTask.jsx
ALTER TABLE assignment_questions ADD COLUMN IF NOT EXISTS difficulty_level TEXT DEFAULT 'medium';
ALTER TABLE assignment_questions ADD COLUMN IF NOT EXISTS ai_feedback_wrong TEXT;
ALTER TABLE assignment_questions ADD COLUMN IF NOT EXISTS correct_answer TEXT;

-- Generate short_id for existing assignments if missing
UPDATE assignments
SET short_id = LPAD(floor(random() * 1000000)::text, 6, '0')
WHERE short_id IS NULL;

-- Ensure short_id is unique and not null for future
ALTER TABLE assignments ALTER COLUMN short_id SET NOT NULL;
ALTER TABLE assignments ADD CONSTRAINT assignments_short_id_unique UNIQUE (short_id);
