-- Fix RLS Policies for Professional LMS
-- Error: new row violates row-level security policy for table "assignment_questions"

-- 1. Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Semua dapat melihat questions" ON assignment_questions;
DROP POLICY IF EXISTS "Guru dapat manage questions" ON assignment_questions;
DROP POLICY IF EXISTS "Semua dapat melihat options" ON assignment_question_options;
DROP POLICY IF EXISTS "Guru dapat manage options" ON assignment_question_options;
DROP POLICY IF EXISTS "Siswa dapat melihat submission sendiri" ON submissions;
DROP POLICY IF EXISTS "Guru dapat melihat submission assignmentnya" ON submissions;
DROP POLICY IF EXISTS "Siswa dapat mengelola submission sendiri" ON submissions;
DROP POLICY IF EXISTS "Siswa dapat melihat jawaban sendiri" ON submission_answers;
DROP POLICY IF EXISTS "Guru dapat melihat jawaban siswa" ON submission_answers;
DROP POLICY IF EXISTS "Siswa dapat mengelola jawaban sendiri" ON submission_answers;

-- 2. Policies for assignment_questions
CREATE POLICY "Semua dapat melihat questions"
  ON assignment_questions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Guru dapat manage questions"
  ON assignment_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM assignments WHERE id = assignment_id AND teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM assignments WHERE id = assignment_id AND teacher_id = auth.uid()));

-- 3. Policies for assignment_question_options
CREATE POLICY "Semua dapat melihat options"
  ON assignment_question_options FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Guru dapat manage options"
  ON assignment_question_options FOR ALL
  USING (EXISTS (
    SELECT 1 FROM assignment_questions q
    JOIN assignments a ON q.assignment_id = a.id
    WHERE q.id = question_id AND a.teacher_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM assignment_questions q
    JOIN assignments a ON q.assignment_id = a.id
    WHERE q.id = question_id AND a.teacher_id = auth.uid()
  ));

-- 4. Policies for submissions
CREATE POLICY "Siswa dapat mengelola submission sendiri"
  ON submissions FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Guru dapat melihat submission assignmentnya"
  ON submissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM assignments WHERE id = assignment_id AND teacher_id = auth.uid()));

-- 5. Policies for submission_answers
CREATE POLICY "Siswa dapat mengelola jawaban sendiri"
  ON submission_answers FOR ALL
  USING (EXISTS (SELECT 1 FROM submissions WHERE id = submission_id AND student_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM submissions WHERE id = submission_id AND student_id = auth.uid()));

CREATE POLICY "Guru dapat melihat jawaban siswa"
  ON submission_answers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM submissions s
    JOIN assignments a ON s.assignment_id = a.id
    WHERE s.id = submission_id AND a.teacher_id = auth.uid()
  ));
