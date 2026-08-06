CREATE TABLE IF NOT EXISTS sdr_insight_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  period_key VARCHAR(40) NOT NULL,
  period_from CHAR(10) NOT NULL,
  period_to CHAR(10) NOT NULL,
  insight_text MEDIUMTEXT NOT NULL,
  stats_json MEDIUMTEXT NULL,
  generated_at DATETIME NOT NULL,
  UNIQUE KEY uq_sdr_insight_period (period_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
