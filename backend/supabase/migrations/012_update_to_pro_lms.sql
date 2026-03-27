-- Migrasi untuk memperbarui tabel yang sudah ada ke versi Professional LMS
-- Menghindari error "column not found" saat db push

-- 1. Update Tabel assignments
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_grading_tolerance_level') THEN
        CREATE TYPE ai_grading_tolerance_level AS ENUM ('ketat', 'sedang', 'fleksibel');
    END IF;
END $$;

ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS ai_grading_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_explanation BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS allow_late_submission BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 1;

-- 2. Buat tabel assignment_questions jika belum ada
CREATE TABLE IF NOT EXISTS assignment_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('pilihan_ganda', 'esai')),
  question_text TEXT NOT NULL,
  voice_preview_url TEXT,
  points INTEGER DEFAULT 0,
  ai_explanation TEXT,
  ai_grading_tolerance ai_grading_tolerance_level DEFAULT 'sedang',
  rubric_text TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Buat tabel assignment_question_options jika belum ada
CREATE TABLE IF NOT EXISTS assignment_question_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES assignment_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0
);

-- 4. Update Tabel submissions
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'submitted', 'graded')),
ADD COLUMN IF NOT EXISTS total_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_feedback_summary TEXT,
ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Buat tabel submission_answers jika belum ada
CREATE TABLE IF NOT EXISTS submission_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES assignment_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  selected_option_id UUID REFERENCES assignment_question_options(id) ON DELETE SET NULL,
  audio_url TEXT,
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  ai_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Buat View Leaderboard (Refreshable)
DROP VIEW IF EXISTS assignment_leaderboard;
CREATE VIEW assignment_leaderboard AS
SELECT
    s.assignment_id,
    p.full_name,
    p.avatar_url,
    MAX(s.total_score) as top_score,
    MIN(s.submitted_at) as first_submitted_at
FROM submissions s
JOIN profiles p ON s.student_id = p.id
WHERE s.status IN ('submitted', 'graded')
GROUP BY s.assignment_id, p.id, p.full_name, p.avatar_url;

-- 7. Aktifkan RLS untuk tabel baru
ALTER TABLE assignment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_answers ENABLE ROW LEVEL SECURITY;

-- 8. Tambahkan Polisi RLS Dasar (Jika belum ada)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Semua dapat melihat questions') THEN
        CREATE POLICY "Semua dapat melihat questions" ON assignment_questions FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
    -- Tambahkan polisi lainnya sesuai kebutuhan
END $$;
