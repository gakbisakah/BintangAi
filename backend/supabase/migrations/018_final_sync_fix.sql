-- 018_final_sync_fix.sql
-- PERBAIKAN TOTAL SINKRONISASI PROFIL

-- 1. Pastikan Trigger sangat aman
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    disability_type,
    linked_student_id
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'siswa'),
    COALESCE(NEW.raw_user_meta_data->>'disability_type', 'tidak_ada'),
    (CASE
      WHEN (NEW.raw_user_meta_data->>'linked_student_id') IS NOT NULL
           AND (NEW.raw_user_meta_data->>'linked_student_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN (NEW.raw_user_meta_data->>'linked_student_id')::UUID
      ELSE NULL
    END)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Jika gagal total, buat profil minimalis agar user tetap bisa login
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, 'User Baru', 'siswa')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Reset RLS Policies agar bersih
DROP POLICY IF EXISTS "Profil dapat dilihat oleh publik" ON profiles;
DROP POLICY IF EXISTS "User dapat memasukkan profil sendiri" ON profiles;
DROP POLICY IF EXISTS "User dapat mengupdate profilnya sendiri" ON profiles;
DROP POLICY IF EXISTS "User dapat melihat profil sendiri" ON profiles;
DROP POLICY IF EXISTS "Profil dapat dilihat oleh semua pengguna terautentikasi" ON profiles;

-- Policy: Semua orang bisa melihat profil (Penting untuk registrasi Ortu cari Siswa)
CREATE POLICY "Profil_Select_Public" ON profiles FOR SELECT USING (true);

-- Policy: User bisa INSERT profilnya sendiri (Cadangan jika trigger lambat)
CREATE POLICY "Profil_Insert_Owner" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy: User bisa UPDATE profilnya sendiri
CREATE POLICY "Profil_Update_Owner" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
