-- 009_student_collaboration.sql
-- Tabel untuk fitur Kolaborasi Antar Siswa (Kelompok Belajar)

-- Tabel Kelompok Belajar
CREATE TABLE study_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel Anggota Kelompok
CREATE TABLE group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, student_id)
);

-- Tabel Pesan Kolaborasi (Chat Kelompok)
CREATE TABLE group_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  audio_url TEXT, -- Untuk pesan suara antar siswa
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel Tugas Kelompok
CREATE TABLE group_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS untuk study_groups
ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Semua user authenticated dapat melihat kelompok" ON study_groups FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Siswa dapat membuat kelompok" ON study_groups FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'siswa'));

-- RLS untuk group_members
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anggota dapat melihat anggota kelompok lain" ON group_members FOR SELECT USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_id AND gm.student_id = auth.uid()));
CREATE POLICY "Siswa dapat bergabung ke kelompok" ON group_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS untuk group_messages
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anggota dapat membaca pesan kelompok" ON group_messages FOR SELECT USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_id AND gm.student_id = auth.uid()));
CREATE POLICY "Anggota dapat mengirim pesan kelompok" ON group_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_id AND gm.student_id = auth.uid()));
