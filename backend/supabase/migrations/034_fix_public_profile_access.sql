-- Memastikan akses SELECT publik pada profiles untuk validasi saat registrasi
-- Hal ini penting agar Orang Tua bisa memverifikasi ID Siswa sebelum mendaftar

DROP POLICY IF EXISTS "Profil dapat dilihat oleh publik" ON profiles;
DROP POLICY IF EXISTS "Profil_Public_Read" ON profiles;

CREATE POLICY "Profil_Public_Read_Access"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);
