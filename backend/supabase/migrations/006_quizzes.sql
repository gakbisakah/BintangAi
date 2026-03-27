-- 006_quizzes.sql
-- Tabel kuis (soal multiple choice dll)
CREATE TABLE quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  questions JSONB NOT NULL, -- array of objects: {question, options, correct_answer}
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- Semua pengguna dapat melihat kuis
CREATE POLICY "Semua pengguna dapat melihat quizzes"
  ON quizzes FOR SELECT
  USING (auth.role() = 'authenticated');

-- Guru dapat insert
CREATE POLICY "Guru dapat insert quizzes"
  ON quizzes FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guru')
  );

-- Guru dapat update/miliknya
CREATE POLICY "Guru dapat update quizzes miliknya"
  ON quizzes FOR UPDATE
  USING (teacher_id = auth.uid());

-- Guru dapat delete
CREATE POLICY "Guru dapat delete quizzes miliknya"
  ON quizzes FOR DELETE
  USING (teacher_id = auth.uid());