CREATE DATABASE IF NOT EXISTS algoritm_center CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE algoritm_center;

CREATE TABLE IF NOT EXISTS courses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  duration VARCHAR(100) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  teacher_name VARCHAR(120) DEFAULT NULL,
  teacher_bio TEXT DEFAULT NULL,
  image_path VARCHAR(255) DEFAULT NULL,
  teacher_image VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(25) NOT NULL,
  course_id INT UNSIGNED NOT NULL,
  note VARCHAR(1000) DEFAULT NULL,
  status ENUM('new','contacted','enrolled','rejected') NOT NULL DEFAULT 'new',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enrolled_at DATETIME DEFAULT NULL,
  CONSTRAINT fk_students_course FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS groups (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id INT UNSIGNED NOT NULL,
  group_name VARCHAR(100) NOT NULL,
  teacher_name VARCHAR(120) DEFAULT NULL,
  schedule VARCHAR(255) DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_groups_course FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  group_id INT UNSIGNED NOT NULL,
  agreed_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active',
  CONSTRAINT fk_enroll_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_enroll_group FOREIGN KEY (group_id) REFERENCES groups(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_method ENUM('cash','card','transfer','other') NOT NULL DEFAULT 'cash',
  note VARCHAR(255) DEFAULT NULL,
  CONSTRAINT fk_payment_student FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO courses (name, price, duration)
SELECT 'Dasturlash', 0, '3 oy'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE name = 'Dasturlash');
INSERT INTO courses (name, price, duration)
SELECT 'Matematika', 0, '3 oy'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE name = 'Matematika');
INSERT INTO courses (name, price, duration)
SELECT 'Ingliz tili', 0, '6 oy'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE name = 'Ingliz tili');

-- Admin hisobini yaratish uchun README.md dagi ko'rsatmaga amal qiling.

-- Saytdagi to‘lov so‘rovlari (Click/Payme haqiqiy integratsiyasi alohida sozlanadi)
CREATE TABLE IF NOT EXISTS online_payment_requests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(25) NOT NULL,
  course_id INT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  provider ENUM('click','payme','bank') NOT NULL DEFAULT 'bank',
  receipt_path VARCHAR(255) DEFAULT NULL,
  payer_card_last4 VARCHAR(4) DEFAULT NULL,
  status ENUM('pending','paid','rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME DEFAULT NULL,
  CONSTRAINT fk_online_payment_course FOREIGN KEY (course_id) REFERENCES courses(id)
);


CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value TEXT NULL
);
INSERT IGNORE INTO site_settings(setting_key,setting_value) VALUES
('about_title','Algoritm o‘quv markazi'),
('about_text','Zamonaviy bilim va amaliy ko‘nikmalar orqali maqsadlaringizga erishing.'),
('phone',''),('address',''),('email',''),('card_number',''),('card_holder',''),('hero_title','Kelajagingizni bilim bilan yarating.'),
('hero_text','Algoritm o‘quv markazida yangi ko‘nikmalarni o‘rganing, maqsadlaringiz sari ishonch bilan qadam qo‘ying.');

-- Online testlar moduli
CREATE TABLE IF NOT EXISTS online_tests (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(180) NOT NULL,
 description TEXT NULL,
 is_active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS test_questions (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 test_id INT UNSIGNED NOT NULL,
 question_text TEXT NOT NULL,
 option_a VARCHAR(500) NOT NULL,
 option_b VARCHAR(500) NOT NULL,
 option_c VARCHAR(500) NOT NULL,
 option_d VARCHAR(500) NOT NULL,
 correct_option ENUM('A','B','C','D') NOT NULL,
 sort_order INT NOT NULL DEFAULT 0,
 CONSTRAINT fk_question_test FOREIGN KEY(test_id) REFERENCES online_tests(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS test_results (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 test_id INT UNSIGNED NOT NULL,
 full_name VARCHAR(120) NOT NULL,
 phone VARCHAR(25) NOT NULL,
 total_questions INT NOT NULL,
 correct_answers INT NOT NULL,
 percentage DECIMAL(5,2) NOT NULL,
 answers_json JSON NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_result_test FOREIGN KEY(test_id) REFERENCES online_tests(id)
);
INSERT IGNORE INTO site_settings(setting_key,setting_value) VALUES
('click_card_number',''),('click_card_holder',''),('payme_card_number',''),('payme_card_holder','');
