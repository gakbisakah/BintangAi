-- Perbaiki RLS agar Guru juga bisa memulai percakapan
DROP POLICY IF EXISTS "Ortu dapat memulai percakapan" ON direct_conversations;
CREATE POLICY "Guru/Ortu dapat memulai percakapan"
ON direct_conversations FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Fungsi untuk mendapatkan daftar Orang Tua yang relevan untuk Guru
CREATE OR REPLACE VIEW teacher_parent_view AS
SELECT
    p.id as parent_id,
    p.full_name as parent_name,
    s.id as student_id,
    s.full_name as student_name,
    t.id as teacher_id
FROM profiles p
JOIN profiles s ON p.linked_student_id = s.id
JOIN profiles t ON s.class_code = t.class_code
WHERE p.role = 'ortu' AND s.role = 'siswa' AND t.role = 'guru';

-- Fungsi untuk mendapatkan Guru anak untuk Orang Tua
CREATE OR REPLACE VIEW parent_teacher_view AS
SELECT
    t.id as teacher_id,
    t.full_name as teacher_name,
    t.subject as teacher_subject,
    p.id as parent_id
FROM profiles p
JOIN profiles s ON p.linked_student_id = s.id
JOIN profiles t ON s.class_code = t.class_code
WHERE p.role = 'ortu' AND s.role = 'siswa' AND t.role = 'guru';
