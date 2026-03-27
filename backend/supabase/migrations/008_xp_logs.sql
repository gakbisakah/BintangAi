-- 008_xp_logs.sql
-- Tabel log perolehan XP siswa (untuk audit trail)
CREATE TABLE xp_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- misal 'submit_tugas', 'jawab_quiz', 'streak_bonus'
  xp_gained INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeks untuk performa
CREATE INDEX idx_xp_logs_student ON xp_logs(student_id);
CREATE INDEX idx_xp_logs_created ON xp_logs(created_at);

-- RLS
ALTER TABLE xp_logs ENABLE ROW LEVEL SECURITY;

-- Siswa dapat melihat log XP sendiri
CREATE POLICY "Siswa dapat melihat log XP sendiri"
  ON xp_logs FOR SELECT
  USING (student_id = auth.uid());

-- Guru/orang tua? Bisa melihat log siswa tertentu (opsional)
-- Untuk sederhana, kita beri akses ke guru melalui policy tambahan
CREATE POLICY "Guru dapat melihat log XP siswa"
  ON xp_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'guru'
    )
  );

-- Insert hanya oleh sistem (edge function / trigger), jadi tidak perlu policy untuk user.
-- Kita berikan hak insert ke service role saja, atau bisa via trigger.
-- Alternatif: beri policy insert untuk authenticated dengan batasan.
-- Di sini kita beri policy insert untuk semua authenticated, karena log tidak sensitif.
CREATE POLICY "Authenticated dapat insert log XP"
  ON xp_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');