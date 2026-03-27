-- Add subject to profiles for teachers
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subject TEXT;

-- Add privacy features to assignments
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS enroll_key TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE;

-- Add privacy features to modules
ALTER TABLE modules ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS enroll_key TEXT;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE;

-- Fix RLS for assignments
-- Memberikan akses SELECT ke semua user terautentikasi agar fitur pencarian ID Kursus berfungsi.
-- Filter tampilan tetap dilakukan di sisi aplikasi atau melalui policy yang lebih spesifik jika diperlukan.
DROP POLICY IF EXISTS "Semua pengguna dapat melihat assignments" ON assignments;
DROP POLICY IF EXISTS "Guru dapat melihat assignments miliknya" ON assignments;
DROP POLICY IF EXISTS "Akses assignments" ON assignments;
CREATE POLICY "Akses assignments"
  ON assignments FOR SELECT
  USING (auth.role() = 'authenticated');


-- Fix RLS for modules
DROP POLICY IF EXISTS "Semua pengguna dapat melihat modul" ON modules;
DROP POLICY IF EXISTS "Guru dapat melihat modul miliknya" ON modules;
DROP POLICY IF EXISTS "Akses modul" ON modules;
CREATE POLICY "Akses modul"
  ON modules FOR SELECT
  USING (auth.role() = 'authenticated');

-- Fix RLS for profiles (Guru dapat update XP siswa)
DROP POLICY IF EXISTS "Guru dapat update XP siswa" ON profiles;
CREATE POLICY "Guru dapat update XP siswa"
  ON profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guru'))
  WITH CHECK (role = 'siswa');
