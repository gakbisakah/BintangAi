-- 015_public_student_list.sql
-- Memperbolehkan pengguna anonim (saat register) melihat daftar siswa agar Orang Tua bisa memilih anak mereka.

DROP POLICY IF EXISTS "Profil dapat dilihat oleh semua pengguna terautentikasi" ON profiles;
DROP POLICY IF EXISTS "Profil dapat dilihat oleh publik" ON profiles;

-- Kebijakan baru: Semua orang (termasuk anon) bisa melihat profil (untuk daftar siswa di register)
CREATE POLICY "Profil dapat dilihat oleh publik"
ON profiles FOR SELECT
USING (true);
