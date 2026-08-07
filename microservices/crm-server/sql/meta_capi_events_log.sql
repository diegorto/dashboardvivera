CREATE TABLE IF NOT EXISTS meta_capi_events_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deal_id INT NOT NULL,
  event_name VARCHAR(64) NOT NULL,
  event_id VARCHAR(64) NULL,
  status ENUM('sent','error','skipped') NOT NULL,
  http_status INT NULL,
  response_body TEXT NULL,
  skip_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_meta_capi_deal_id (deal_id),
  INDEX idx_meta_capi_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
