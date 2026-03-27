-- 033_add_student_reports.sql
-- Tabel untuk menyimpan laporan mingguan/bulanan yang di-generate AI

CREATE TABLE student_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL, -- Isi narasi dari AI
  report_type TEXT DEFAULT 'mingguan', -- mingguan, bulanan, khusus
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE student_reports ENABLE ROW LEVEL SECURITY;

-- Guru bisa melihat laporan yang mereka buat
CREATE POLICY "Guru dapat melihat laporan buatannya"
ON student_reports FOR SELECT
USING (teacher_id = auth.uid());

-- Guru bisa membuat laporan
CREATE POLICY "Guru dapat membuat laporan"
ON student_reports FOR INSERT
WITH CHECK (teacher_id = auth.uid());

-- Siswa bisa melihat laporan mereka sendiri
CREATE POLICY "Siswa dapat melihat laporan sendiri"
ON student_reports FOR SELECT
USING (student_id = auth.uid());

-- Orang Tua bisa melihat laporan anak mereka
CREATE POLICY "Orang Tua dapat melihat laporan anak"
ON student_reports FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND linked_student_id = student_reports.student_id
  )
);
