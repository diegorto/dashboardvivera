CREATE TABLE IF NOT EXISTS calendar_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deal_id INT NULL,
  dentist_user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'confirmed',
  google_event_id VARCHAR(255) NULL,
  created_by_user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dentist_start (dentist_user_id, start_at),
  INDEX idx_deal (deal_id),
  UNIQUE KEY uniq_google_event (google_event_id),
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL,
  FOREIGN KEY (dentist_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  user_id INT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NULL,
  expiry_date BIGINT NULL,
  calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
  sync_token TEXT NULL,
  last_synced_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
