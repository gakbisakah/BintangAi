-- 1. Fungsi untuk Menambah Bonus XP secara aman
CREATE OR REPLACE FUNCTION add_bonus_xp(target_student_id UUID, amount INT)
RETURNS VOID AS $$
BEGIN
    -- Validasi: Pastikan pengirim adalah guru
    IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'guru') THEN
        UPDATE profiles
        SET xp = COALESCE(xp, 0) + amount
        WHERE id = target_student_id;
    ELSE
        RAISE EXCEPTION 'Hanya guru yang dapat memberikan bonus XP';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fungsi untuk Mengatur Izin Remidi secara aman
CREATE OR REPLACE FUNCTION toggle_retake(target_submission_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_status BOOLEAN;
BEGIN
    -- Validasi: Pastikan pengirim adalah guru pemilik assignment
    SELECT s.allow_retake INTO current_status
    FROM submissions s
    JOIN assignments a ON s.assignment_id = a.id
    WHERE s.id = target_submission_id AND a.teacher_id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Akses ditolak atau tugas tidak ditemukan';
    END IF;

    UPDATE submissions
    SET allow_retake = NOT current_status
    WHERE id = target_submission_id;

    RETURN NOT current_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Tetap sediakan RLS dasar untuk antisipasi
DROP POLICY IF EXISTS "Guru dapat update XP siswa" ON profiles;
CREATE POLICY "Guru dapat update XP siswa" ON profiles FOR UPDATE USING (auth.role() = 'authenticated');
