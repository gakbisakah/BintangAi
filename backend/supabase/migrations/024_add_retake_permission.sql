-- 1. Tambahkan kolom allow_retake jika belum ada
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS allow_retake BOOLEAN DEFAULT FALSE;

-- 2. Kebijakan RLS agar Guru bisa mengizinkan remidi
DROP POLICY IF EXISTS "Guru dapat update allow_retake pada submission" ON submissions;
CREATE POLICY "Guru dapat update allow_retake pada submission"
  ON submissions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.id = submissions.assignment_id
    AND assignments.teacher_id = auth.uid()
  ));

-- 3. Fungsi Trigger untuk Validasi Remidi dan Otomatisasi XP
CREATE OR REPLACE FUNCTION handle_submission_logic()
RETURNS TRIGGER AS $$
DECLARE
    is_teacher BOOLEAN;
BEGIN
    -- Identifikasi role user
    SELECT (role = 'guru') INTO is_teacher FROM profiles WHERE id = auth.uid();

    -- A. PROTEKSI: Siswa tidak boleh mengizinkan remidi untuk diri sendiri
    IF NOT COALESCE(is_teacher, false) AND NEW.allow_retake = TRUE AND (OLD.allow_retake IS NULL OR OLD.allow_retake = FALSE) THEN
        NEW.allow_retake := FALSE;
    END IF;

    -- B. VALIDASI PENGERJAAN (REMIDI)
    IF (NEW.status = 'ongoing') THEN
        IF (TG_OP = 'INSERT') THEN
            IF EXISTS (
                SELECT 1 FROM submissions
                WHERE assignment_id = NEW.assignment_id
                AND student_id = NEW.student_id
                AND status IN ('submitted', 'graded')
            ) THEN
                RAISE EXCEPTION 'Anda sudah mengerjakan tugas ini. Silakan hubungi guru untuk izin remidi.';
            END IF;
        ELSIF (TG_OP = 'UPDATE' AND OLD.status IN ('submitted', 'graded')) THEN
            IF (OLD.allow_retake = FALSE) THEN
                RAISE EXCEPTION 'Pengerjaan ulang tidak diizinkan tanpa persetujuan guru.';
            END IF;
            NEW.total_score := 0;
            NEW.submitted_at := NULL;
            NEW.attempt_number := COALESCE(OLD.attempt_number, 1) + 1;
            NEW.allow_retake := FALSE;
        END IF;
    END IF;

    -- C. OTOMATISASI XP
    IF (NEW.status = 'graded' AND (OLD.status IS NULL OR OLD.status != 'graded')) THEN
        UPDATE profiles
        SET xp = xp + COALESCE(NEW.total_score, 0)
        WHERE id = NEW.student_id;
        INSERT INTO xp_logs (student_id, action, xp_gained)
        VALUES (NEW.student_id, 'assignment_completion', COALESCE(NEW.total_score, 0));
        NEW.allow_retake := FALSE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Pasang Trigger ke tabel submissions
DROP TRIGGER IF EXISTS trg_handle_submission_logic ON submissions;
CREATE TRIGGER trg_handle_submission_logic
    BEFORE INSERT OR UPDATE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION handle_submission_logic();
