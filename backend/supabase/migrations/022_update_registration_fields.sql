-- 022_update_registration_fields.sql
-- Menambahkan kolom yang diperlukan untuk pendaftaran Siswa dan Guru sesuai kebutuhan baru

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS class_level TEXT, -- Untuk siswa (1-6 SD) atau kelas yang diampu guru
ADD COLUMN IF NOT EXISTS slb_name TEXT,    -- Nama SLB
ADD COLUMN IF NOT EXISTS class_code TEXT;  -- Kode unik kelas untuk guru, atau kode yang dimasukkan siswa

-- Index untuk mempercepat pencarian class_code saat siswa bergabung
CREATE INDEX IF NOT EXISTS idx_profiles_class_code ON profiles(class_code);

-- Update trigger handle_new_user untuk menyertakan metadata baru jika ada
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  raw_linked_id TEXT;
  valid_linked_id UUID;
  teacher_slb TEXT;
  teacher_class TEXT;
  target_role TEXT;
  input_class_code TEXT;
BEGIN
  raw_linked_id := NEW.raw_user_meta_data->>'linked_student_id';
  target_role := COALESCE(NEW.raw_user_meta_data->>'role', 'siswa');
  input_class_code := NEW.raw_user_meta_data->>'class_code';

  -- Validasi UUID Linked Student ID (Jika ada)
  IF raw_linked_id IS NOT NULL AND raw_linked_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    valid_linked_id := raw_linked_id::UUID;
  ELSE
    valid_linked_id := NULL;
  END IF;

  -- OTOMATISASI NAMA SLB DAN KELAS UNTUK SISWA BERDASARKAN KODE KELAS GURU
  teacher_slb := NEW.raw_user_meta_data->>'slb_name';
  teacher_class := NEW.raw_user_meta_data->>'class_level';

  IF target_role = 'siswa' AND input_class_code IS NOT NULL THEN
    -- Cari nama SLB dan Kelas dari profil guru yang memiliki kode kelas tersebut
    SELECT slb_name, class_level INTO teacher_slb, teacher_class
    FROM public.profiles
    WHERE role = 'guru' AND class_code = input_class_code
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    disability_type,
    linked_student_id,
    class_level,
    slb_name,
    class_code,
    subject
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    target_role,
    COALESCE(NEW.raw_user_meta_data->>'disability_type', 'tidak_ada'),
    valid_linked_id,
    COALESCE(teacher_class, NEW.raw_user_meta_data->>'class_level'),
    COALESCE(teacher_slb, NEW.raw_user_meta_data->>'slb_name'),
    input_class_code,
    NEW.raw_user_meta_data->>'subject'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    disability_type = EXCLUDED.disability_type,
    linked_student_id = EXCLUDED.linked_student_id,
    class_level = EXCLUDED.class_level,
    slb_name = EXCLUDED.slb_name,
    class_code = EXCLUDED.class_code,
    subject = EXCLUDED.subject;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'), 'siswa')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
