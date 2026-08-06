-- Seed: estrutura REAL extraida do export do Pipedrive da Vivera (deals 2585908824)
USE vivera_crm;

INSERT INTO pipelines (slug, name, sort, pipedrive_id) VALUES
  ('inbound',    'Inbound',       1, 1),
  ('recepcao',   'Recepção',      2, 2),
  ('base-leads', 'Base de Leads', 3, NULL),
  ('indicacao',  'Indicação',     4, NULL),
  ('rmkt',       'RMKT',          5, NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name), sort = VALUES(sort);

-- Etapas do Inbound (ordem do fluxo de cadencia D+N usado pela equipe)
INSERT INTO stages (pipeline_id, skey, label, sort, rotting_days) VALUES
  ((SELECT id FROM pipelines WHERE slug='inbound'), 'entrada',        'Entrada',                    1, 1),
  ((SELECT id FROM pipelines WHERE slug='inbound'), 'dia-seguinte',   'Dia seguinte',               2, 1),
  ((SELECT id FROM pipelines WHERE slug='inbound'), 'd1',             'D + 1',                      3, 1),
  ((SELECT id FROM pipelines WHERE slug='inbound'), 'd2',             'D + 2',                      4, 1),
  ((SELECT id FROM pipelines WHERE slug='inbound'), 'd3',             'D +3',                       5, 1),
  ((SELECT id FROM pipelines WHERE slug='inbound'), 'd4',             'D + 4',                      6, 1),
  ((SELECT id FROM pipelines WHERE slug='inbound'), 'd5',             'D + 5',                      7, 2),
  ((SELECT id FROM pipelines WHERE slug='inbound'), 'contato',        'Contato Realizado',          8, 3),
  ((SELECT id FROM pipelines WHERE slug='inbound'), 'qualificado',    'Qualificado',                9, 3),
  ((SELECT id FROM pipelines WHERE slug='inbound'), 'agendamento',    'Agendamento Realizado',     10, 5),
  ((SELECT id FROM pipelines WHERE slug='inbound'), 'nao-compareceu', 'Não Compareceu - reagendar',11, 3),
  ((SELECT id FROM pipelines WHERE slug='inbound'), 'cancelou',       'Cancelou/Desmarcou',        12, 3),
  ((SELECT id FROM pipelines WHERE slug='inbound'), 'comparecimento', 'Comparecimento',            13, 5),
  ((SELECT id FROM pipelines WHERE slug='inbound'), 'follow1',        'Follow Up 1',               14, 5),
  ((SELECT id FROM pipelines WHERE slug='inbound'), 'follow2',        'Follow Up 2',               15, 7)
ON DUPLICATE KEY UPDATE label = VALUES(label), sort = VALUES(sort);

INSERT INTO stages (pipeline_id, skey, label, sort, rotting_days) VALUES
  ((SELECT id FROM pipelines WHERE slug='recepcao'), 'entrada',    'Entrada',               1, 3),
  ((SELECT id FROM pipelines WHERE slug='recepcao'), 'orcamento',  'Orçamento',             2, 7),
  ((SELECT id FROM pipelines WHERE slug='recepcao'), 'inicio',     'Início de Tratamento',  3, NULL),
  ((SELECT id FROM pipelines WHERE slug='recepcao'), 'tratamento', 'Em Tratamento',         4, NULL),
  ((SELECT id FROM pipelines WHERE slug='recepcao'), 'fim',        'Fim de Procedimento',   5, NULL)
ON DUPLICATE KEY UPDATE label = VALUES(label), sort = VALUES(sort);

INSERT INTO stages (pipeline_id, skey, label, sort, rotting_days) VALUES
  ((SELECT id FROM pipelines WHERE slug='base-leads'), 'entrada', 'Entrada',           1, NULL),
  ((SELECT id FROM pipelines WHERE slug='base-leads'), 'contato', 'Contato Realizado', 2, NULL)
ON DUPLICATE KEY UPDATE label = VALUES(label), sort = VALUES(sort);

INSERT INTO stages (pipeline_id, skey, label, sort, rotting_days) VALUES
  ((SELECT id FROM pipelines WHERE slug='indicacao'), 'recebida',       'Indicação Recebida', 1, 3),
  ((SELECT id FROM pipelines WHERE slug='indicacao'), 'comparecimento', 'Comparecimento',     2, 5)
ON DUPLICATE KEY UPDATE label = VALUES(label), sort = VALUES(sort);

INSERT INTO stages (pipeline_id, skey, label, sort, rotting_days) VALUES
  ((SELECT id FROM pipelines WHERE slug='rmkt'), 'interesse', 'Demonstrou Interesse', 1, 5)
ON DUPLICATE KEY UPDATE label = VALUES(label), sort = VALUES(sort);

-- Origens de marketing REAIS do campo "Origem" do Pipedrive
INSERT INTO lead_origins (name, pipedrive_option_id, sort) VALUES
  ('Instagram', NULL, 1),
  ('Facebook', NULL, 2),
  ('Google', NULL, 3),
  ('Indicação de paciente', 87, 4),
  ('Indicação (dentro da clinica)', NULL, 5),
  ('Já é paciente', NULL, 6),
  ('Orgânico', NULL, 7),
  ('Campanhas sazonais', NULL, 8),
  ('Origem não Identificada', NULL, 9)
ON DUPLICATE KEY UPDATE sort = VALUES(sort);

-- Etiquetas REAIS vistas no export
INSERT INTO labels (name, color) VALUES
  ('Lead MKT', 'teal'),
  ('HOF', 'purple'),
  ('Implantes', 'blue'),
  ('Nunca Respondeu', 'red'),
  ('Não Responde', 'red'),
  ('Passou por Dia Seguinte', 'gray'),
  ('Passou por D + 1', 'gray'),
  ('Passou por D + 2', 'gray'),
  ('Passou por D + 3', 'gray'),
  ('Passou por D + 4', 'gray'),
  ('Passou por D + 5', 'gray'),
  ('já é paciente', 'green'),
  ('Dra Kissya', 'amber'),
  ('odontologia', 'blue')
ON DUPLICATE KEY UPDATE color = VALUES(color);

-- Procedimentos REAIS do campo "Procedimento"
INSERT INTO procedures (name, sort) VALUES
  ('Método Evolution', 1),
  ('Exojet', 2),
  ('Fios APTOS', 3),
  ('Implantes Dentários Sem Cortes (Cirurgia Guiada)', 4),
  ('Ultraformer MPT', 5),
  ('Toxina botulínica', 6),
  ('Ácido Hialurônico', 7),
  ('Protocolo Evolution Full Face', 8),
  ('Invisalign - Alinhadores Transparentes', 9),
  ('Lentes de Contato Dental Biomiméticas', 10),
  ('Não identificado', 99)
ON DUPLICATE KEY UPDATE sort = VALUES(sort);
