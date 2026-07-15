# Arquitetura do Agente Autônomo de Sincronização

## Visão Geral

O **Executive OS Data Governance Agent** é um sistema de orquestração de dados que sincroniza informações entre **Clairis** (origem) e **Pipedrive** (destino), passando por camadas de governança, normalização, auditoria e aprovação.

## Fluxo de Execução

```
02:00 → Login Clairis
  ↓
02:05 → Exportação de Planilhas
  ↓
02:20 → Validação de Arquivos
  ↓
02:30 → Importação para Staging
  ↓
02:40 → Normalização de Dados
  ↓
02:50 → Comparação (Motor de Matching)
  ↓
03:10 → Geração de Auditoria
  ↓
03:20 → Fila de Aprovação
  ↓
(Aguarda Aprovação Humana/IA)
  ↓
→ Atualização Pipedrive
  ↓
→ Atualização Executive OS
  ↓
→ Análise de Jornada
  ↓
→ KPIs e Dashboards
  ↓
→ Backup
```

## Componentes Principais

### 1. **Clairis Module** (`src/clairis/`)
- `auth.py`: Login automático via Playwright
- `exporter.py`: Exportação de todas as 11 planilhas
- `validator.py`: Validação de estrutura e conteúdo

### 2. **Staging** (`src/staging/`)
- Banco temporário para todos os dados
- Nenhum dado vai diretamente ao CRM
- Base para normalização e comparação

### 3. **Normalization** (`src/normalization/`)
- Padronização de telefones: `5548999999999`
- Nomes: capitalização e remoção de caracteres
- CPF: sem máscara
- Datas: formato ISO `YYYY-MM-DD`
- Status: valores padrão

### 4. **Comparison** (`src/comparison/`)
Estratégia de matching em cascata:
1. ID Clairis
2. **Telefone** (PRINCIPAL - nunca duplica)
3. CPF
4. E-mail
5. Nome + Data de nascimento
6. Fuzzy Match (85%+)

### 5. **Audit** (`src/audit/`)
Gera registros com:
- Campo modificado
- Valor antigo vs novo
- Nível de confiança (0-100)
- Sugestão da IA
- Status (PENDENTE, APROVADO, REJEITADO, etc)

### 6. **Approval Queue** (`src/approval/`)
- Fila diária de alterações
- Permite: Aprovar, Rejeitar, Ignorar, Corrigir
- Interface para colaboradores/gestores
- Histórico permanente

### 7. **Patient Journey** (`src/journey/`)
Análise automática respondendo:
1. Paciente agendou?
2. Compareceu?
3. Faltou? (com reagendamento?)
4. Possui agendamento futuro?
5. Realizou orçamento?
6. Orçamento foi fechado?
7. Existe follow-up?

**Classificações geradas:**
- Agendado, Confirmado, Compareceu, Faltou
- Em tratamento, Orçamento pendente, Orçamento fechado
- Inadimplente, Jornada concluída

**Priorização:**
- 🔴 Crítico: Orçamento alto parado, sem agendamento
- 🟠 Alto: Faltou, não reagendou
- 🟡 Médio: Aguardando decisão
- 🟢 Baixo: Tratamento em andamento

### 8. **Pipedrive Update** (`src/pipedrive/`)
Atualização segura APENAS após aprovação:
- Pessoas, Organizações, Negócios
- Productos, Estágios, Valores
- Campos personalizados, Origem, Campanha
- Sincronização incremental (upsert)
- Nunca apagar registros

### 9. **Executive OS** (`src/executive_os/`)
Banco principal para:
- Dashboard Executivo
- KPIs de negócio
- Comercial, Marketing, Financeiro
- Clínico, IA Analítica

## Banco de Dados

### Tabelas de Staging
- `staging_patients`
- `staging_budgets`
- `staging_budgets_rejected`
- `staging_appointments`

### Tabelas de Auditoria
- `audit_logs` (com status PENDENTE/APROVADO/REJEITADO)
- `approval_queue` (fila de aprovação)

### Tabelas de Jornada
- `patient_journey` (status e prioridade)

### Tabelas de Sincronização
- `sync_execution` (histórico de execuções)
- `sync_logs` (logs detalhados por etapa)

## Configuração

Veja `.env.example` para todas as variáveis:

```env
CLAIRIS_EMAIL=comet.ia@vivera.com.br
CLAIRIS_PASSWORD=CometIA@2026
PIPEDRIVE_API_TOKEN=seu_token_aqui
SYNC_SCHEDULE=0 2 * * *  # 02:00 todos os dias
```

## Logs e Auditoria

- Logs estruturados em JSON
- Arquivo diário por módulo
- Console em tempo real
- Nada é perdido
- Histórico permanente no banco

## Monitoramento

- **Grafana**: Dashboard executivo
- **Prometheus**: Métricas de execução
- **Status das sincronizações**: Real-time
- **Alertas de erro**: Imediatos

## Segurança

- Autenticação via Playwright (navegador real)
- Tokens armazenados em variáveis de ambiente
- Sem credenciais em logs
- Auditoria de todas as ações
- Aprovação antes de qualquer alteração no CRM
