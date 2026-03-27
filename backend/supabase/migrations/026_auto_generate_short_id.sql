-- Fungsi untuk menghasilkan short_id acak 6 digit
CREATE OR REPLACE FUNCTION generate_short_id()
RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  done BOOL;
BEGIN
  done := false;
  WHILE NOT done LOOP
    new_id := LPAD(floor(random() * 1000000)::text, 6, '0');
    -- Pastikan unik (cek di assignments, bisa ditambah tabel lain jika perlu)
    IF NOT EXISTS (SELECT 1 FROM assignments WHERE short_id = new_id) THEN
      done := true;
    END IF;
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Set DEFAULT untuk assignments.short_id
ALTER TABLE assignments ALTER COLUMN short_id SET DEFAULT generate_short_id();

-- Jika tabel modules juga menggunakan short_id dan bermasalah, kita set juga
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modules' AND column_name = 'short_id') THEN
    ALTER TABLE modules ALTER COLUMN short_id SET DEFAULT LPAD(floor(random() * 1000000)::text, 6, '0');
  END IF;
END $$;
