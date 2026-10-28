USE algoritm_center;

-- O‘quvchi kursga qabul qilingan sanani alohida saqlash.
ALTER TABLE students ADD COLUMN enrolled_at DATETIME NULL AFTER created_at;
UPDATE students SET enrolled_at = created_at WHERE status = 'enrolled' AND enrolled_at IS NULL;

-- Bu migratsiya mavjud bazaga faqat bir marta qo‘llanadi.
