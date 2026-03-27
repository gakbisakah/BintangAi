-- 004_submissions.sql
-- Tabel Jawaban Siswa (Professional LMS Version)
CREATE TABLE submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'submitted', 'graded')),
  total_score INTEGER DEFAULT 0,
  ai_feedback_summary TEXT, -- Summary feedback AI untuk seluruh tugas
  attempt_number INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel Detail Jawaban per Soal
CREATE TABLE submission_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES assignment_questions(id) ON DELETE CASCADE,
  answer_text TEXT, -- Teks jawaban (esai atau pilihan ganda label/id)
  selected_option_id UUID REFERENCES assignment_question_options(id) ON DELETE SET NULL,
  audio_url TEXT, -- Jika dijawab lewat suara
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  ai_feedback TEXT, -- Feedback per soal
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leaderboard View (Berdasarkan Skor Tertinggi per Assignment)
CREATE OR REPLACE VIEW assignment_leaderboard AS
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

CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_answers ENABLE ROW LEVEL SECURITY;

-- Policies for submissions
CREATE POLICY "Siswa dapat melihat submission sendiri"
  ON submissions FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Guru dapat melihat submission assignmentnya"
  ON submissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM assignments WHERE id = assignment_id AND teacher_id = auth.uid()));

CREATE POLICY "Siswa dapat mengelola submission sendiri"
  ON submissions FOR ALL
  USING (student_id = auth.uid());

-- Policies for submission_answers
CREATE POLICY "Siswa dapat melihat jawaban sendiri"
  ON submission_answers FOR SELECT
  USING (EXISTS (SELECT 1 FROM submissions WHERE id = submission_id AND student_id = auth.uid()));

CREATE POLICY "Guru dapat melihat jawaban siswa"
  ON submission_answers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM submissions s
    JOIN assignments a ON s.assignment_id = a.id
    WHERE s.id = submission_id AND a.teacher_id = auth.uid()
  ));

CREATE POLICY "Siswa dapat mengelola jawaban sendiri"
  ON submission_answers FOR ALL
  USING (EXISTS (SELECT 1 FROM submissions WHERE id = submission_id AND student_id = auth.uid()));