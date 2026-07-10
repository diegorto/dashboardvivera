-- Schema do whatsapp-monitor. Rodar uma vez no banco (CREATE DATABASE vivera_whatsapp; USE vivera_whatsapp;)

-- SESSOES BAILEYS (2 numeros)
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_name VARCHAR(100) UNIQUE,
  sdr_name VARCHAR(100),
  phone_number VARCHAR(50),
  fallback_session VARCHAR(100),
  qr_code LONGTEXT,
  status VARCHAR(50),
  in_call BOOLEAN DEFAULT FALSE,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_connected TIMESTAMP NULL
);

-- CONVERSAS (vinculadas a ambos numeros via Pipedrive)
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(255) UNIQUE,
  pipedrive_id VARCHAR(255),
  client_phone VARCHAR(50),
  client_name VARCHAR(100),
  assigned_to VARCHAR(100),
  labels JSON,
  status VARCHAR(50) DEFAULT 'active',
  pipedrive_stage VARCHAR(100),
  pipedrive_value DECIMAL(10, 2),
  synced_from VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP NULL,
  script_adherence FLOAT,
  analyzed_at TIMESTAMP NULL,
  INDEX (assigned_to),
  INDEX (pipedrive_id),
  INDEX (status)
);

-- MENSAGENS (de ambos numeros)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(255),
  session_name VARCHAR(100), -- 'helenice' ou 'agda'
  sdr_name VARCHAR(100),
  phone_number VARCHAR(50),
  from_number VARCHAR(50),
  from_type VARCHAR(50), -- 'client' ou 'sdr'
  text LONGTEXT,
  direction VARCHAR(50), -- 'inbound' ou 'outbound'
  status VARCHAR(50),
  analyzed BOOLEAN DEFAULT FALSE,
  analysis_score FLOAT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(conversation_id),
  INDEX (sdr_name),
  INDEX (direction),
  INDEX (timestamp)
);

-- CHAMADAS (de ambos numeros)
CREATE TABLE IF NOT EXISTS whatsapp_calls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(255),
  session_name VARCHAR(100), -- 'helenice' ou 'agda'
  sdr_name VARCHAR(100),
  phone_number VARCHAR(50),
  call_id VARCHAR(255),
  to_number VARCHAR(50),
  call_timestamp TIMESTAMP NULL,
  status VARCHAR(50), -- 'missed', 'completed', 'rejected', 'pending'
  duration_seconds INT DEFAULT 0,
  attempted_from_other BOOLEAN DEFAULT FALSE, -- se tentou do outro numero
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(conversation_id),
  INDEX (sdr_name),
  INDEX (status),
  INDEX (call_timestamp)
);

-- LOG SINCRONIZACAO PIPEDRIVE
CREATE TABLE IF NOT EXISTS pipedrive_sync_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(100),
  direction VARCHAR(50),
  pipedrive_id VARCHAR(255),
  conversation_id VARCHAR(255),
  details JSON,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- METRICAS DIARIAS
CREATE TABLE IF NOT EXISTS daily_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sdr_name VARCHAR(100),
  date DATE,
  total_messages INT DEFAULT 0,
  total_calls INT DEFAULT 0,
  total_conversations INT DEFAULT 0,
  messages_analyzed INT DEFAULT 0,
  messages_conforming INT DEFAULT 0,
  calls_answered INT DEFAULT 0,
  calls_missed INT DEFAULT 0,
  avg_script_adherence FLOAT DEFAULT 0,
  avg_call_duration INT DEFAULT 0,
  issues JSON,
  UNIQUE KEY (sdr_name, date)
);

-- MAPEAMENTO PIPEDRIVE
CREATE TABLE IF NOT EXISTS pipedrive_users_mapping (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pipedrive_user_id VARCHAR(100),
  pipedrive_user_name VARCHAR(100),
  sdr_name VARCHAR(100),
  UNIQUE KEY (pipedrive_user_id)
);

-- SESSOES INICIAIS (Helenice e Agda, com fallback uma pra outra)
INSERT IGNORE INTO whatsapp_sessions (session_name, sdr_name, phone_number, fallback_session, status)
VALUES
  ('helenice', 'Helenice', '+55 48 99120-4285', 'agda', 'disconnected'),
  ('agda', 'Agda', '+5548991415196', 'helenice', 'disconnected');

-- Exemplo de mapeamento de usuarios do Pipedrive (ajustar os IDs reais antes de rodar)
-- INSERT INTO pipedrive_users_mapping (pipedrive_user_id, pipedrive_user_name, sdr_name)
-- VALUES ('123456', 'Helenice', 'helenice'), ('789012', 'Agda', 'agda');
