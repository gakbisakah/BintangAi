-- 010_teacher_parent_chat.sql
-- Tabel untuk fitur Chat antara Guru dan Orang Tua (Komunikasi Ekosistem)

-- Tabel Percakapan (Satu Guru dengan Satu Orang Tua)
CREATE TABLE direct_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Konteks anak yang dibahas
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, parent_id, student_id)
);

-- Tabel Pesan (Direct Message)
CREATE TABLE direct_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  audio_url TEXT, -- Guru atau ortu bisa kirim voice note
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS untuk direct_conversations
ALTER TABLE direct_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guru/Ortu dapat melihat percakapannya" ON direct_conversations FOR SELECT USING (auth.uid() = teacher_id OR auth.uid() = parent_id);
CREATE POLICY "Ortu dapat memulai percakapan" ON direct_conversations FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ortu'));

-- RLS untuk direct_messages
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Peserta percakapan dapat membaca pesan" ON direct_messages FOR SELECT USING (EXISTS (SELECT 1 FROM direct_conversations dc WHERE dc.id = conversation_id AND (dc.teacher_id = auth.uid() OR dc.parent_id = auth.uid())));
CREATE POLICY "Peserta percakapan dapat mengirim pesan" ON direct_messages FOR INSERT WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM direct_conversations dc WHERE dc.id = conversation_id AND (dc.teacher_id = auth.uid() OR dc.parent_id = auth.uid())));

-- Indeks untuk pencarian pesan cepat
CREATE INDEX idx_direct_messages_convo ON direct_messages(conversation_id);
CREATE INDEX idx_direct_messages_created ON direct_messages(created_at);
