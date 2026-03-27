-- 016_update_handle_new_user.sql
-- Memperbarui fungsi trigger agar sangat kuat (Robust) terhadap kegagalan

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  student_id_val TEXT;
  target_role TEXT;
BEGIN
  student_id_val := NEW.raw_user_meta_data->>'linked_student_id';
  target_role := COALESCE(NEW.raw_user_meta_data->>'role', 'siswa');

  INSERT INTO public.profiles (
    id,
    full_name,
    avatar_url,
    role,
    disability_type,
    linked_student_id,
    student_password_hash
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    target_role,
    COALESCE(NEW.raw_user_meta_data->>'disability_type', 'tidak_ada'),
    (CASE
      -- Pastikan ID Siswa hanya di-cast jika formatnya benar-benar UUID
      WHEN student_id_val IS NOT NULL AND student_id_val ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN student_id_val::UUID
      ELSE NULL
    END),
    NEW.raw_user_meta_data->>'student_password_hash'
  );
  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- FALLBACK: Jika terjadi error apapun, tetap buat profil dasar agar user bisa login
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    target_role
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
