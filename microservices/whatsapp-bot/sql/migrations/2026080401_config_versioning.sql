-- Fase 0.4: versionamento de chatbot_ai_config + tabela de propostas de prompt
-- Aplicado em 2026-08-04. Reversivel via 2026080401_config_versioning_rollback.sql

CREATE TABLE IF NOT EXISTS chatbot_config_versions (
  id INT NOT NULL AUTO_INCREMENT,
  config_key VARCHAR(100) NOT NULL,
  old_value MEDIUMTEXT,
  new_value MEDIUMTEXT,
  changed_by VARCHAR(100) DEFAULT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_config_key (config_key),
  KEY idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS prompt_proposals (
  id INT NOT NULL AUTO_INCREMENT,
  diff MEDIUMTEXT NOT NULL,
  evidencia MEDIUMTEXT,
  status ENUM('pendente','aprovada','rejeitada') NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

