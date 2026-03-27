-- 014_parent_student_link.sql
-- Menambahkan relasi antara Orang Tua dan Anak (Siswa)

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS linked_student_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS student_password_hash TEXT; -- Password pengaman untuk akses ortu

-- Kebijakan RLS agar Orang Tua bisa melihat data anak yang di-link
CREATE POLICY "Orang Tua dapat melihat profil anak yang di-link"
ON profiles
FOR SELECT
USING (
  (role = 'siswa' AND id IN (SELECT linked_student_id FROM profiles WHERE id = auth.uid()))
  OR (auth.uid() = id)
);

-- Kebijakan agar Orang Tua bisa melihat tugas/submission anak
CREATE POLICY "Orang Tua dapat melihat submission anak"
ON submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'ortu' AND linked_student_id = submissions.student_id
  )
);
