-- 002_modules.sql
-- Tabel modul yang diunggah guru
CREATE TABLE modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  pdf_url TEXT, -- URL ke file PDF di storage
  summary TEXT, -- ringkasan dari AI
  simplified TEXT, -- versi sederhana dari AI
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger untuk updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_modules_updated_at
  BEFORE UPDATE ON modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

-- Kebijakan: semua pengguna terautentikasi dapat melihat modul
CREATE POLICY "Semua pengguna dapat melihat modul"
  ON modules FOR SELECT
  USING (auth.role() = 'authenticated');

-- Kebijakan: hanya guru yang dapat menambah/modul miliknya
CREATE POLICY "Guru dapat insert modul"
  ON modules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'guru'
    )
  );

CREATE POLICY "Guru dapat update modul miliknya"
  ON modules FOR UPDATE
  USING (
    teacher_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guru')
  );

CREATE POLICY "Guru dapat delete modul miliknya"
  ON modules FOR DELETE
  USING (
    teacher_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guru')
  );