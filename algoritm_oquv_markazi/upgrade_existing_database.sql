-- Mavjud algoritm_center bazasi uchun bir marta ishga tushiring.
USE algoritm_center;
ALTER TABLE courses ADD COLUMN description TEXT NULL;
ALTER TABLE courses ADD COLUMN teacher_name VARCHAR(120) NULL;
ALTER TABLE courses ADD COLUMN teacher_bio TEXT NULL;
ALTER TABLE courses ADD COLUMN image_path VARCHAR(255) NULL;
ALTER TABLE courses ADD COLUMN teacher_image VARCHAR(255) NULL;
ALTER TABLE online_payment_requests ADD COLUMN receipt_path VARCHAR(255) NULL;
ALTER TABLE online_payment_requests ADD COLUMN payer_card_last4 VARCHAR(4) NULL;
CREATE TABLE IF NOT EXISTS site_settings (setting_key VARCHAR(80) PRIMARY KEY, setting_value TEXT NULL);
INSERT IGNORE INTO site_settings(setting_key,setting_value) VALUES ('about_title','Algoritm o‘quv markazi'),('about_text','Zamonaviy bilim va amaliy ko‘nikmalar orqali maqsadlaringizga erishing.'),('phone',''),('address',''),('email',''),('card_number',''),('card_holder',''),('hero_title','Kelajagingizni bilim bilan yarating.'),('hero_text','Algoritm o‘quv markazida yangi ko‘nikmalarni o‘rganing, maqsadlaringiz sari ishonch bilan qadam qo‘ying.');
