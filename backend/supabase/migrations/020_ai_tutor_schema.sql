-- Tabel riwayat percakapan AI yang lebih lengkap
CREATE TABLE IF NOT EXISTS ai_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  topic TEXT DEFAULT 'Umum',
  disability_context TEXT,
  grade_context INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI interactions"
  ON ai_interactions FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Users can insert their own AI interactions"
  ON ai_interactions FOR INSERT
  WITH CHECK (auth.uid() = student_id);
