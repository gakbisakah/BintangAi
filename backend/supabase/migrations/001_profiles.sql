-- 001_profiles.sql
-- Ekstensi yang diperlukan
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabel profiles (melengkapi auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('siswa', 'guru', 'ortu')) DEFAULT 'siswa',
  disability_type TEXT CHECK (disability_type IN ('tunanetra', 'tunarungu', 'tunawicara', 'tidak_ada')) DEFAULT 'tidak_ada',
  full_name TEXT,
  avatar_url TEXT,
  xp INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_active DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger untuk membuat profile otomatis saat user baru
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role, disability_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'siswa'),
    COALESCE(NEW.raw_user_meta_data->>'disability_type', 'tidak_ada')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Kebijakan: profil dapat dilihat oleh semua pengguna terautentikasi
CREATE POLICY "Profil dapat dilihat oleh semua pengguna terautentikasi"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Kebijakan: user dapat mengupdate profilnya sendiri
CREATE POLICY "User dapat mengupdate profilnya sendiri"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Kebijakan: hanya admin (guru?) dapat mengubah role? (opsional)
-- Untuk sederhananya, kita batasi update hanya oleh pemilik