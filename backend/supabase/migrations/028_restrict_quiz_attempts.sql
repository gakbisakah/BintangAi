-- Perbarui fungsi logika submission untuk pembatasan ketat
CREATE OR REPLACE FUNCTION handle_submission_logic()
RETURNS TRIGGER AS $$
DECLARE
    is_teacher BOOLEAN;
    existing_sub_status TEXT;
    existing_allow_retake BOOLEAN;
BEGIN
    -- Identifikasi role user
    SELECT (role = 'guru') INTO is_teacher FROM profiles WHERE id = auth.uid();

    -- A. PROTEKSI: Siswa tidak boleh mengizinkan remidi sendiri
    IF NOT COALESCE(is_teacher, false) AND NEW.allow_retake = TRUE AND (OLD.allow_retake IS NULL OR OLD.allow_retake = FALSE) THEN
        NEW.allow_retake := FALSE;
    END IF;

    -- B. VALIDASI PENGERJAAN (REMIDI & PEMBATASAN)
    IF (TG_OP = 'INSERT') THEN
        -- Cek apakah sudah pernah mengerjakan sebelumnya
        SELECT status, allow_retake INTO existing_sub_status, existing_allow_retake
        FROM submissions
        WHERE assignment_id = NEW.assignment_id AND student_id = NEW.student_id
        LIMIT 1;

        IF FOUND THEN
            IF existing_allow_retake = TRUE THEN
                -- Jika ada izin remidi, hapus data lama atau arahkan ke UPDATE (Tergantung logika aplikasi)
                -- Untuk konsistensi, kita biarkan frontend melakukan UPDATE jika allow_retake = true
                RAISE EXCEPTION 'Gunakan data pengerjaan yang sudah ada untuk remidi.';
            ELSE
                RAISE EXCEPTION 'Anda sudah mengerjakan tugas ini dan tidak memiliki izin remidi.';
            END IF;
        END IF;
    END IF;

    -- C. OTOMATISASI XP SAAT SELESAI
    IF (NEW.status = 'graded' AND (OLD.status IS NULL OR OLD.status != 'graded')) THEN
        UPDATE profiles
        SET xp = xp + COALESCE(NEW.total_score, 0)
        WHERE id = NEW.student_id;

        -- Reset allow_retake setelah digunakan
        NEW.allow_retake := FALSE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
