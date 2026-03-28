-- FIX: Memastikan ID Siswa dapat ditemukan saat registrasi Orang Tua
-- Masalah: RLS mungkin memblokir akses SELECT untuk pengguna anonim (belum login)

-- 1. Berikan hak akses eksplisit ke role anon dan authenticated
GRANT SELECT ON public.profiles TO anon, authenticated;

-- 2. Bersihkan policy lama yang mungkin tumpang tindih
DROP POLICY IF EXISTS "Profil dapat dilihat oleh publik" ON public.profiles;
DROP POLICY IF EXISTS "Profil_Public_Read" ON public.profiles;
DROP POLICY IF EXISTS "Profil_Select_Public_Safe" ON public.profiles;
DROP POLICY IF EXISTS "Profil_Public_Read_Access" ON public.profiles;
DROP POLICY IF EXISTS "Profil_Select_Public_Safe_Final" ON public.profiles;

-- 3. Buat policy tunggal yang mengizinkan semua orang melihat profil
-- (Penting agar Orang Tua bisa memverifikasi ID anak sebelum mendaftar)
CREATE POLICY "Profil_Public_Select_Policy"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);

-- 4. Pastikan RLS aktif
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
