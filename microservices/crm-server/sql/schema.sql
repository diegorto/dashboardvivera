-- ============================================================
-- VIVERA CRM - Schema MySQL
-- Banco proprio do CRM (substitui o Pipedrive como fonte da verdade)
-- Rodar uma vez: CREATE DATABASE vivera_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- ============================================================

CREATE DATABASE IF NOT EXISTS vivera_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vivera_crm;

-- ---------- USUARIOS (login do CRM) ----------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','sdr','closer','recepcao') NOT NULL DEFAULT 'sdr',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------- FUNIS (pipelines) ----------
CREATE TABLE IF NOT EXISTS pipelines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  sort INT NOT NULL DEFAULT 0,
  pipedrive_id INT NULL,               -- mapeamento p/ varredura de conferencia
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- ETAPAS DO FUNIL ----------
CREATE TABLE IF NOT EXISTS stages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pipeline_id INT NOT NULL,
  skey VARCHAR(60) NOT NULL,           -- ex: 'lead', 'qualificado', 'agendado'
  label VARCHAR(120) NOT NULL,
  sort INT NOT NULL DEFAULT 0,
  color VARCHAR(30) NULL,              -- token opcional p/ UI
  rotting_days INT NULL,               -- dias ate considerar "parado" (estilo Pipedrive)
  pipedrive_id INT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_stage (pipeline_id, skey),
  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id)
);

-- ---------- PACIENTES (pessoas/contatos) ----------
CREATE TABLE IF NOT EXISTS patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  phone VARCHAR(40) NULL,              -- normalizado +55...
  email VARCHAR(190) NULL,
  cpf VARCHAR(20) NULL,
  birth_date DATE NULL,
  notes TEXT NULL,
  -- origem / indicacao
  referred_by_patient_id INT NULL,     -- quem indicou este paciente
  -- ltv e cashback sao calculados do ledger, mas mantemos snapshot p/ listagem rapida
  ltv DECIMAL(12,2) NOT NULL DEFAULT 0,
  cashback_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- sincronizacao
  pipedrive_person_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_pd_person (pipedrive_person_id),
  FOREIGN KEY (referred_by_patient_id) REFERENCES patients(id)
);

-- ---------- NEGOCIOS (deals / cards do kanban) ----------
CREATE TABLE IF NOT EXISTS deals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  pipeline_id INT NOT NULL,
  stage_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  value DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('open','won','lost') NOT NULL DEFAULT 'open',
  procedure_name VARCHAR(190) NULL,
  -- atribuicao de marketing (liga o lead a campanha p/ ROI)
  origem VARCHAR(60) NULL,             -- Meta / Google / Indicacao / Organico...
  plataforma VARCHAR(60) NULL,
  campanha VARCHAR(190) NULL,
  conjunto VARCHAR(190) NULL,
  criativo VARCHAR(190) NULL,
  palavra_chave VARCHAR(190) NULL,
  -- responsaveis
  sdr_user_id INT NULL,
  closer_user_id INT NULL,
  owner_name VARCHAR(120) NULL,        -- nome livre (compat. migracao)
  -- datas
  add_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  won_date DATETIME NULL,
  lost_date DATETIME NULL,
  stage_entered_at DATETIME NULL,      -- quando entrou na etapa atual
  -- perda
  loss_reason VARCHAR(190) NULL,
  objections JSON NULL,                -- ['preco', 'medo', ...]
  tags JSON NULL,
  -- sincronizacao / conferencia com Pipedrive
  pipedrive_id INT NULL,
  sync_status ENUM('local','imported','verified','divergent') NOT NULL DEFAULT 'local',
  sync_checked_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_stage (stage_id),
  INDEX idx_status (status),
  INDEX idx_pd_deal (pipedrive_id),
  INDEX idx_campanha (campanha),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id),
  FOREIGN KEY (stage_id) REFERENCES stages(id),
  FOREIGN KEY (sdr_user_id) REFERENCES users(id),
  FOREIGN KEY (closer_user_id) REFERENCES users(id)
);

-- ---------- ATIVIDADES / NOTAS / TAREFAS ----------
CREATE TABLE IF NOT EXISTS activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deal_id INT NULL,
  patient_id INT NULL,
  user_id INT NULL,
  type ENUM('note','task','call','whatsapp','meeting','stage_change','system') NOT NULL DEFAULT 'note',
  content TEXT NOT NULL,
  due_at DATETIME NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_deal (deal_id),
  INDEX idx_patient (patient_id),
  INDEX idx_due (due_at, done),
  FOREIGN KEY (deal_id) REFERENCES deals(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ---------- HISTORICO DE ETAPAS (jornada do paciente) ----------
CREATE TABLE IF NOT EXISTS stage_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deal_id INT NOT NULL,
  from_stage_id INT NULL,
  to_stage_id INT NOT NULL,
  changed_by_user_id INT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_deal_hist (deal_id, changed_at),
  FOREIGN KEY (deal_id) REFERENCES deals(id)
);

-- ---------- INDICACOES (base do cashback) ----------
CREATE TABLE IF NOT EXISTS referrals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  referrer_patient_id INT NOT NULL,    -- quem indicou
  referred_patient_id INT NOT NULL,    -- quem foi indicado
  deal_id INT NULL,                    -- negocio gerado pela indicacao
  status ENUM('pendente','fechou','perdida') NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  UNIQUE KEY uq_referral (referrer_patient_id, referred_patient_id),
  FOREIGN KEY (referrer_patient_id) REFERENCES patients(id),
  FOREIGN KEY (referred_patient_id) REFERENCES patients(id),
  FOREIGN KEY (deal_id) REFERENCES deals(id)
);

-- ---------- CASHBACK (extrato) ----------
CREATE TABLE IF NOT EXISTS cashback_ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  type ENUM('ganho_ltv','ganho_indicacao','resgate','ajuste') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,       -- positivo = credito, negativo = debito
  source_deal_id INT NULL,
  referral_id INT NULL,
  description VARCHAR(255) NULL,
  created_by_user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cb_patient (patient_id, created_at),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (source_deal_id) REFERENCES deals(id),
  FOREIGN KEY (referral_id) REFERENCES referrals(id)
);

-- ---------- ETIQUETAS (labels, como no Pipedrive) ----------
CREATE TABLE IF NOT EXISTS labels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  color VARCHAR(30) NOT NULL DEFAULT 'gray',  -- green|amber|red|blue|purple|teal|gray
  pipedrive_id INT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS deal_labels (
  deal_id INT NOT NULL,
  label_id INT NOT NULL,
  PRIMARY KEY (deal_id, label_id),
  FOREIGN KEY (deal_id) REFERENCES deals(id),
  FOREIGN KEY (label_id) REFERENCES labels(id)
);

-- ---------- ORIGENS DE MARKETING (lista escolhivel + Tintim automatico) ----------
CREATE TABLE IF NOT EXISTS lead_origins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  pipedrive_option_id INT NULL,        -- 88=Meta, 87=Indicacao (auditoria)
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort INT NOT NULL DEFAULT 0
);

-- ---------- PROCEDIMENTOS (catalogo da clinica; obrigatorio na venda) ----------
CREATE TABLE IF NOT EXISTS procedures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL UNIQUE,
  pipedrive_option_id INT NULL,        -- id da opcao no campo "procedimento" do Pipedrive
  default_value DECIMAL(12,2) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort INT NOT NULL DEFAULT 0
);

-- ---------- VARREDURA / SINCRONIZACAO PIPEDRIVE ----------
CREATE TABLE IF NOT EXISTS sync_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kind ENUM('import','reconcile') NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  api_calls_used INT NOT NULL DEFAULT 0,
  deals_checked INT NOT NULL DEFAULT 0,
  deals_fixed INT NOT NULL DEFAULT 0,
  total_pending INT NULL,              -- quantos ainda faltam p/ varrer 100%
  pct_complete DECIMAL(5,2) NULL,
  status ENUM('running','ok','error') NOT NULL DEFAULT 'running',
  error TEXT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  skey VARCHAR(60) PRIMARY KEY,        -- ex: 'reconcile_cursor'
  svalue TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
