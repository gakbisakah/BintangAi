-- 005_ai_cache.sql
-- Tabel cache untuk respons AI (HuggingFace)
CREATE TABLE ai_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_hash TEXT NOT NULL, -- SHA256 dari input+model
  model TEXT NOT NULL,        -- nama model HuggingFace
  input_text TEXT NOT NULL,
  output_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeks untuk lookup cepat
CREATE UNIQUE INDEX idx_ai_cache_hash ON ai_cache(content_hash, model);
CREATE INDEX idx_ai_cache_created ON ai_cache(created_at);

-- RLS: semua pengguna terautentikasi dapat membaca cache (untuk efisiensi)
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Semua pengguna dapat membaca cache"
  ON ai_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- Hanya edge function (via service role) yang dapat menulis, jadi tidak perlu policy insert untuk user.
-- Atau kita beri policy insert untuk semua authenticated, karena cache tidak sensitif.
CREATE POLICY "Authenticated dapat insert cache"
  ON ai_cache FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');