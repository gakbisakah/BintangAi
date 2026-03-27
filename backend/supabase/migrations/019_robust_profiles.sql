-- 019_robust_profiles.sql
-- PERBAIKAN FINAL SINKRONISASI & RLS PROFILES

-- 1. Optimasi Fungsi Trigger (Handle New User)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  raw_linked_id TEXT;
  valid_linked_id UUID;
BEGIN
  raw_linked_id := NEW.raw_user_meta_data->>'linked_student_id';

  -- Validasi UUID Linked Student ID (Jika ada)
  IF raw_linked_id IS NOT NULL AND raw_linked_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    valid_linked_id := raw_linked_id::UUID;
  ELSE
    valid_linked_id := NULL;
  END IF;

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
    valid_linked_id
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    disability_type = EXCLUDED.disability_type,
    linked_student_id = EXCLUDED.linked_student_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Fallback: Pastikan baris profile minimal tercipta agar tidak gagal login
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'), 'siswa')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Memastikan RLS Terbuka untuk Pemilik Akun (INSERT, SELECT, UPDATE)
DROP POLICY IF EXISTS "Profil_Select_Public" ON profiles;
DROP POLICY IF EXISTS "Profil_Insert_Owner" ON profiles;
DROP POLICY IF EXISTS "Profil_Update_Owner" ON profiles;

CREATE POLICY "Profil_Owner_Full_Access"
ON profiles FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Profil_Public_Read"
ON profiles FOR SELECT
USING (true);
