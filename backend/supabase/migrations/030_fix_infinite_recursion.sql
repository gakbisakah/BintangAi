-- 030_fix_infinite_recursion.sql
-- Memperbaiki error "infinite recursion detected in policy" pada tabel profiles

-- 1. Hapus kebijakan yang bermasalah (jika ada)
DROP POLICY IF EXISTS "Profil dapat dilihat oleh semua pengguna terautentikasi" ON profiles;
DROP POLICY IF EXISTS "Profil dapat dilihat oleh publik" ON profiles;
DROP POLICY IF EXISTS "Guru dapat update XP siswa" ON profiles;

-- 2. Kebijakan SELECT yang aman (Tanpa subquery ke tabel profiles itu sendiri jika memungkinkan, atau gunakan auth.jwt())
-- Menggunakan true atau auth.role() = 'authenticated' adalah yang paling aman dari rekursi.
CREATE POLICY "Profil dapat dilihat oleh publik"
ON profiles FOR SELECT
USING (true);

-- 3. Kebijakan UPDATE yang aman
-- User bisa update profil sendiri
CREATE POLICY "User dapat mengupdate profilnya sendiri"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Guru bisa update profil siswa (untuk XP) tanpa rekursi
-- Kita gunakan metadata dari JWT untuk mengecek role guru guna menghindari query ke tabel profiles itu sendiri di dalam policy
CREATE POLICY "Guru dapat update profil siswa"
ON profiles FOR UPDATE
USING (
  (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'guru'
  AND role = 'siswa'
)
WITH CHECK (
  (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'guru'
  AND role = 'siswa'
);
