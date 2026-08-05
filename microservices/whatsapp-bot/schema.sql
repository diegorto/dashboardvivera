CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_name VARCHAR(64) NOT NULL DEFAULT 'default',
  status ENUM('disconnected','qr_pending','connected') NOT NULL DEFAULT 'disconnected',
  qr_code MEDIUMTEXT NULL,
  phone_number VARCHAR(32) NULL,
  connected_at DATETIME NULL,
  last_seen DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_session_name (session_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(32) NOT NULL,
  contact_name VARCHAR(191) NULL,
  patient_id INT NULL,
  deal_id INT NULL,
  ai_enabled TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  active_flow_id INT NULL,
  active_node_id INT NULL,
  flow_state JSON NULL,
  last_message_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_phone (phone),
  KEY idx_patient (patient_id),
  KEY idx_deal (deal_id),
  CONSTRAINT fk_wac_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  CONSTRAINT fk_wac_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  direction ENUM('in','out') NOT NULL,
  message_type VARCHAR(32) NOT NULL DEFAULT 'text',
  content MEDIUMTEXT NULL,
  media_url VARCHAR(500) NULL,
  wa_message_id VARCHAR(191) NULL,
  sent_by ENUM('lead','ai','human','system') NOT NULL DEFAULT 'lead',
  status VARCHAR(32) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_conv (conversation_id),
  CONSTRAINT fk_wam_conv FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chatbot_flows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  description VARCHAR(500) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  trigger_keyword VARCHAR(191) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chatbot_flow_nodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  flow_id INT NOT NULL,
  node_type ENUM('trigger','message','question','condition','wait','reminder','end') NOT NULL,
  label VARCHAR(191) NULL,
  position_x INT NOT NULL DEFAULT 0,
  position_y INT NOT NULL DEFAULT 0,
  config JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_flow (flow_id),
  CONSTRAINT fk_cfn_flow FOREIGN KEY (flow_id) REFERENCES chatbot_flows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chatbot_flow_edges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  flow_id INT NOT NULL,
  source_node_id INT NOT NULL,
  source_handle VARCHAR(64) NULL,
  target_node_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_flow_edges (flow_id),
  CONSTRAINT fk_cfe_flow FOREIGN KEY (flow_id) REFERENCES chatbot_flows(id) ON DELETE CASCADE,
  CONSTRAINT fk_cfe_source FOREIGN KEY (source_node_id) REFERENCES chatbot_flow_nodes(id) ON DELETE CASCADE,
  CONSTRAINT fk_cfe_target FOREIGN KEY (target_node_id) REFERENCES chatbot_flow_nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chatbot_ai_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL,
  config_value MEDIUMTEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
