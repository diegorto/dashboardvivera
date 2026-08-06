-- Dados de exemplo APENAS para desenvolvimento local / screenshots. NAO rodar na VPS.
USE vivera_crm;

INSERT INTO patients (name, phone, email, ltv) VALUES
  ('João Silva', '+5548999990001', 'joao@email.com', 12000),
  ('Maria Santos', '+5548999990002', 'maria@email.com', 8500),
  ('Ana Oliveira', '+5548999990003', NULL, 0),
  ('Carlos Souza', '+5548999990004', NULL, 0),
  ('Fernanda Lima', '+5548999990005', NULL, 0),
  ('Roberto Alves', '+5548999990006', NULL, 0),
  ('Patrícia Gomes', '+5548999990007', NULL, 0),
  ('Lucas Pereira', '+5548999990008', NULL, 0),
  ('Juliana Costa', '+5548999990009', NULL, 0),
  ('Marcos Dias', '+5548999990010', NULL, 0);

-- indicacao: Maria indicou Ana
UPDATE patients SET referred_by_patient_id = (SELECT id FROM (SELECT id FROM patients WHERE name='Maria Santos') t)
  WHERE name = 'Ana Oliveira';
INSERT INTO referrals (referrer_patient_id, referred_patient_id, status)
  SELECT p1.id, p2.id, 'pendente' FROM patients p1, patients p2
  WHERE p1.name='Maria Santos' AND p2.name='Ana Oliveira';

SET @inbound = (SELECT id FROM pipelines WHERE slug='inbound');
SET @s_lead = (SELECT id FROM stages WHERE pipeline_id=@inbound AND skey='lead');
SET @s_qual = (SELECT id FROM stages WHERE pipeline_id=@inbound AND skey='qualificado');
SET @s_agen = (SELECT id FROM stages WHERE pipeline_id=@inbound AND skey='agendado');
SET @s_comp = (SELECT id FROM stages WHERE pipeline_id=@inbound AND skey='compareceu');
SET @s_orc  = (SELECT id FROM stages WHERE pipeline_id=@inbound AND skey='orcamento');
SET @s_fech = (SELECT id FROM stages WHERE pipeline_id=@inbound AND skey='fechamento');

INSERT INTO deals (patient_id, pipeline_id, stage_id, title, value, status, procedure_name, origem, campanha, conjunto, criativo, owner_name, add_date, stage_entered_at, won_date) VALUES
  ((SELECT id FROM patients WHERE name='Ana Oliveira'), @inbound, @s_lead, 'Ana Oliveira - Harmonização', 6500, 'open', 'Harmonização Facial', 'Indicação', NULL, NULL, NULL, 'Helenice', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NULL),
  ((SELECT id FROM patients WHERE name='Carlos Souza'), @inbound, @s_lead, 'Carlos Souza - Ultraformer', 9000, 'open', 'Ultraformer MPT', 'Meta', 'PAT | [HOF][DORES]', '[WHATSAPP][PUBLICO FRIO]', 'VID | Depoimento Dor', 'Agda', NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NULL),
  ((SELECT id FROM patients WHERE name='Fernanda Lima'), @inbound, @s_qual, 'Fernanda Lima - Toxina', 3200, 'open', 'Toxina Botulínica', 'Meta', 'ESTETICA | [REJUVENESCIMENTO]', '[FACEBOOK][PUBLICO QUENTE]', 'IMG | Antes e Depois', 'Helenice', NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 2 DAY, NULL),
  ((SELECT id FROM patients WHERE name='Roberto Alves'), @inbound, @s_qual, 'Roberto Alves - Bruxismo', 4800, 'open', 'Tratamento Bruxismo', 'Google', 'SEARCH | Bruxismo', NULL, 'dor na atm', 'Agda', NOW() - INTERVAL 8 DAY, NOW() - INTERVAL 6 DAY, NULL),
  ((SELECT id FROM patients WHERE name='Patrícia Gomes'), @inbound, @s_agen, 'Patrícia Gomes - Avaliação HOF', 7500, 'open', 'Harmonização Facial', 'Meta', 'PAT | [HOF][DORES]', '[WHATSAPP][PUBLICO FRIO]', 'VID | Depoimento Dor', 'Helenice', NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 4 DAY, NULL),
  ((SELECT id FROM patients WHERE name='Lucas Pereira'), @inbound, @s_comp, 'Lucas Pereira - Ultraformer', 11000, 'open', 'Ultraformer MPT', 'Meta', 'PAT | [HOF][DORES]', '[INSTAGRAM][LOOKALIKE]', 'VID | Resultado 30 dias', 'Agda', NOW() - INTERVAL 12 DAY, NOW() - INTERVAL 1 DAY, NULL),
  ((SELECT id FROM patients WHERE name='Juliana Costa'), @inbound, @s_orc, 'Juliana Costa - Lentes', 15500, 'open', 'Lentes de Contato Dental', 'Indicação', NULL, NULL, NULL, 'Helenice', NOW() - INTERVAL 15 DAY, NOW() - INTERVAL 7 DAY, NULL),
  ((SELECT id FROM patients WHERE name='Marcos Dias'), @inbound, @s_fech, 'Marcos Dias - Harmonização', 8900, 'open', 'Harmonização Facial', 'Google', 'PMAX | Estética', NULL, NULL, 'Agda', NOW() - INTERVAL 20 DAY, NOW() - INTERVAL 9 DAY, NULL),
  ((SELECT id FROM patients WHERE name='João Silva'), @inbound, @s_fech, 'João Silva - Ultraformer', 12000, 'won', 'Ultraformer MPT', 'Meta', 'PAT | [HOF][DORES]', '[WHATSAPP][PUBLICO FRIO]', 'VID | Depoimento Dor', 'Helenice', NOW() - INTERVAL 30 DAY, NOW() - INTERVAL 22 DAY, NOW() - INTERVAL 22 DAY),
  ((SELECT id FROM patients WHERE name='Maria Santos'), @inbound, @s_fech, 'Maria Santos - Toxina', 8500, 'won', 'Toxina Botulínica', 'Meta', 'ESTETICA | [REJUVENESCIMENTO]', '[FACEBOOK][PUBLICO QUENTE]', 'IMG | Antes e Depois', 'Agda', NOW() - INTERVAL 28 DAY, NOW() - INTERVAL 20 DAY, NOW() - INTERVAL 20 DAY);

-- historico de etapas de exemplo (jornada)
INSERT INTO stage_history (deal_id, from_stage_id, to_stage_id, changed_at)
SELECT d.id, NULL, @s_lead, d.add_date FROM deals d;
INSERT INTO stage_history (deal_id, from_stage_id, to_stage_id, changed_at)
SELECT d.id, @s_lead, d.stage_id, d.stage_entered_at FROM deals d WHERE d.stage_id <> @s_lead;

-- atividades de exemplo
INSERT INTO activities (deal_id, patient_id, type, content, created_at)
SELECT d.id, d.patient_id, 'whatsapp', 'Primeiro contato pelo WhatsApp — respondeu interessada.', d.add_date + INTERVAL 1 HOUR FROM deals d LIMIT 5;
INSERT INTO activities (deal_id, patient_id, type, content, due_at, done)
SELECT d.id, d.patient_id, 'task', 'Fazer follow-up da proposta', NOW() + INTERVAL 1 DAY, 0 FROM deals d WHERE d.stage_id = @s_orc;

-- etiquetas de exemplo nos cards
INSERT INTO deal_labels (deal_id, label_id)
SELECT d.id, l.id FROM deals d, labels l WHERE d.title LIKE 'Carlos%' AND l.name = 'Quente';
INSERT INTO deal_labels (deal_id, label_id)
SELECT d.id, l.id FROM deals d, labels l WHERE d.title LIKE 'Juliana%' AND l.name = 'VIP';
INSERT INTO deal_labels (deal_id, label_id)
SELECT d.id, l.id FROM deals d, labels l WHERE d.title LIKE 'Roberto%' AND l.name = 'Não rastreado';
INSERT INTO deal_labels (deal_id, label_id)
SELECT d.id, l.id FROM deals d, labels l WHERE d.title LIKE 'Patrícia%' AND l.name = 'Retorno';

-- atividades programadas (bolinha do Pipedrive: atrasada / hoje / futura)
INSERT INTO activities (deal_id, patient_id, type, content, due_at, done)
SELECT d.id, d.patient_id, 'call', 'Ligar para confirmar interesse', NOW() - INTERVAL 1 DAY, 0 FROM deals d WHERE d.title LIKE 'Roberto%';
INSERT INTO activities (deal_id, patient_id, type, content, due_at, done)
SELECT d.id, d.patient_id, 'whatsapp', 'Enviar orçamento pelo WhatsApp', NOW() + INTERVAL 2 HOUR, 0 FROM deals d WHERE d.title LIKE 'Juliana%';
INSERT INTO activities (deal_id, patient_id, type, content, due_at, done)
SELECT d.id, d.patient_id, 'meeting', 'Avaliação presencial na clínica', NOW() + INTERVAL 3 DAY, 0 FROM deals d WHERE d.title LIKE 'Patrícia%';

-- cashback de exemplo: Maria ganhou por LTV
INSERT INTO cashback_ledger (patient_id, type, amount, description)
SELECT id, 'ganho_ltv', 425.00, 'Cashback 5% sobre Toxina (R$ 8.500)' FROM patients WHERE name='Maria Santos';
UPDATE patients SET cashback_balance = 425 WHERE name='Maria Santos';
