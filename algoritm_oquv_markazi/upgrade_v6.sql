USE algoritm_center;
CREATE TABLE IF NOT EXISTS online_tests (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, title VARCHAR(180) NOT NULL, description TEXT NULL,
 is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS test_questions (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, test_id INT UNSIGNED NOT NULL, question_text TEXT NOT NULL,
 option_a VARCHAR(500) NOT NULL, option_b VARCHAR(500) NOT NULL, option_c VARCHAR(500) NOT NULL, option_d VARCHAR(500) NOT NULL,
 correct_option ENUM('A','B','C','D') NOT NULL, sort_order INT NOT NULL DEFAULT 0,
 CONSTRAINT fk_question_test FOREIGN KEY(test_id) REFERENCES online_tests(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS test_results (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, test_id INT UNSIGNED NOT NULL, full_name VARCHAR(120) NOT NULL,
 phone VARCHAR(25) NOT NULL, total_questions INT NOT NULL, correct_answers INT NOT NULL, percentage DECIMAL(5,2) NOT NULL,
 answers_json JSON NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_result_test FOREIGN KEY(test_id) REFERENCES online_tests(id)
);
INSERT IGNORE INTO site_settings(setting_key,setting_value) VALUES
('click_card_number',''),('click_card_holder',''),('payme_card_number',''),('payme_card_holder','');
