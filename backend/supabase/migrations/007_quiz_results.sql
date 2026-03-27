-- 007_quiz_results.sql
-- Tabel hasil kuis siswa
CREATE TABLE quiz_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL, -- nilai (misal 0-100)
  answers JSONB NOT NULL, -- array jawaban siswa
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

-- Siswa dapat melihat hasilnya sendiri
CREATE POLICY "Siswa dapat melihat hasil quiz sendiri"
  ON quiz_results FOR SELECT
  USING (student_id = auth.uid());

-- Guru dapat melihat semua hasil quiz yang dia buat
CREATE POLICY "Guru dapat melihat hasil quiz assignmentnya"
  ON quiz_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      WHERE q.id = quiz_id AND q.teacher_id = auth.uid()
    )
  );

-- Siswa dapat insert hasil quiz (saat menyelesaikan)
CREATE POLICY "Siswa dapat submit hasil quiz"
  ON quiz_results FOR INSERT
  WITH CHECK (
    student_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'siswa')
  );

-- Tidak perlu update, hasil quiz bersifat final