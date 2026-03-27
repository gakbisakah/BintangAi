-- 003_assignments.sql
-- Tabel tugas yang dibuat guru (Professional LMS Version)
CREATE TYPE ai_grading_tolerance_level AS ENUM ('ketat', 'sedang', 'fleksibel');

CREATE TABLE assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT, -- Rich Text + Instruksi
  module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deadline TIMESTAMPTZ,
  duration_minutes INTEGER, -- Opsional: menit pengerjaan
  ai_grading_enabled BOOLEAN DEFAULT TRUE,
  show_explanation BOOLEAN DEFAULT TRUE,
  allow_late_submission BOOLEAN DEFAULT FALSE,
  shuffle_questions BOOLEAN DEFAULT FALSE,
  max_attempts INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel Soal Tugas
CREATE TABLE assignment_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('pilihan_ganda', 'esai')),
  question_text TEXT NOT NULL,
  voice_preview_url TEXT, -- Untuk tunanetra
  points INTEGER DEFAULT 0,
  ai_explanation TEXT, -- Penjelasan untuk AI Feedback
  ai_grading_tolerance ai_grading_tolerance_level DEFAULT 'sedang',
  rubric_text TEXT, -- Untuk Esai
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel Opsi Jawaban (Pilihan Ganda)
CREATE TABLE assignment_question_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES assignment_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0
);

CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_question_options ENABLE ROW LEVEL SECURITY;

-- Policies for assignments
CREATE POLICY "Semua pengguna dapat melihat assignments"
  ON assignments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Guru dapat insert assignments"
  ON assignments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guru'));

CREATE POLICY "Guru dapat update assignments miliknya"
  ON assignments FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Guru dapat delete assignments miliknya"
  ON assignments FOR DELETE
  USING (teacher_id = auth.uid());

-- Policies for questions
CREATE POLICY "Semua dapat melihat questions"
  ON assignment_questions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Guru dapat manage questions"
  ON assignment_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM assignments WHERE id = assignment_id AND teacher_id = auth.uid()));

-- Policies for options
CREATE POLICY "Semua dapat melihat options"
  ON assignment_question_options FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Guru dapat manage options"
  ON assignment_question_options FOR ALL
  USING (EXISTS (
    SELECT 1 FROM assignment_questions q
    JOIN assignments a ON q.assignment_id = a.id
    WHERE q.id = question_id AND a.teacher_id = auth.uid()
  ));