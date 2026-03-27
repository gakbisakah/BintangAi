-- 031_fix_teacher_view_results_recursion.sql
-- Memperbaiki error "infinite recursion detected in policy" saat guru melihat hasil/submissions.

-- 1. Bersihkan policy lama yang bermasalah pada tabel submissions
DROP POLICY IF EXISTS "Guru dapat melihat submission assignmentnya" ON submissions;
DROP POLICY IF EXISTS "Guru dapat melihat jawaban siswa" ON submission_answers;

-- 2. Kebijakan SELECT pada submissions untuk Guru
-- Kita gunakan auth.jwt() metadata 'role' untuk menghindari query rekursif ke tabel profiles.
CREATE POLICY "Guru_Select_Submissions"
ON submissions FOR SELECT
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'guru'
  OR
  student_id = auth.uid()
);

-- 3. Kebijakan SELECT pada submission_answers untuk Guru
CREATE POLICY "Guru_Select_Submission_Answers"
ON submission_answers FOR SELECT
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'guru'
  OR
  EXISTS (
    SELECT 1 FROM submissions s
    WHERE s.id = submission_id AND s.student_id = auth.uid()
  )
);

-- 4. Pastikan policy pada profiles juga bersih dari rekursi (Double check dari migrasi sebelumnya)
DROP POLICY IF EXISTS "Profil dapat dilihat oleh publik" ON profiles;
CREATE POLICY "Profil_Select_Public_Safe"
ON profiles FOR SELECT
USING (true);
