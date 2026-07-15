# Executive OS: Camada de Governança de Dados - Arquitetura

**Status**: 🟡 PLANEJAMENTO  
**Data**: 2026-07-15  
**Branch**: `claude/reinice-ren84r`  
**Fase**: Pré-Implementação (Anterior à Fase 7)

---

## 📋 Visão Geral

O Executive OS evoluirá de um dashboard conectado ao Pipedrive para um **Sistema de Governança de Dados Empresarial** capaz de receber dados de qualquer fonte (Clairis, WhatsApp, ERP, Meta Ads, Google Ads, etc.) sem necessidade de reestruturação.

### Princípio Fundamental
```
Múltiplas Fontes de Dados → Normalização → Comparação → Auditoria → Jornada do Paciente → Dashboards & IA
```

---

## 🏗️ Arquitetura em Camadas

```
┌─────────────────────────────────────────────────────────────┐
│                    DASHBOARDS & IA (Existentes)            │
│  (Executive, Marketing, Commercial, Agenda, Professionals) │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│           CAMADA DE APRESENTAÇÃO (Nova)                     │
│  Auditoria | Jornada | Comparação | Normalização | Conflitos│
│  Fila de Aprovação | Histórico | Logs | Regras | Config    │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│         CAMADA DE NEGÓCIO (Nova)                            │
│  - Motor de Normalização                                    │
│  - Motor de Comparação                                      │
│  - Motor de Auditoria                                       │
│  - Motor de Jornada do Paciente                            │
│  - Classificador de Pacientes                              │
│  - Priorizador                                             │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│       CAMADA DE DADOS (Nova)                                │
│  - Repositórios de Auditoria                                │
│  - Repositórios de Jornada                                 │
│  - Repositórios de Integração                              │
│  - Repositórios de Comparação                              │
│  - Repositórios de Aprovação                               │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│     CAMADA DE INTEGRAÇÃO (Nova - Abstração)                │
│  IDataSource (Interface)                                    │
│    ├─ CRMDataSource (abstrato)                             │
│    ├─ ERP DataSource (abstrato)                            │
│    ├─ AgendaDataSource (abstrato)                          │
│    ├─ FinanceiroDataSource (abstrato)                      │
│    └─ MarketingDataSource (abstrato)                       │
│                                                            │
│  (Implementações Futuras: PipedriveDataSource, etc)        │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│              BANCO DE DADOS (Nova)                          │
│  [Tabelas de Governança, Auditoria, Jornada, Sincronização]│
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Entidades do Banco de Dados

### Grupo 1: Integração & Sincronização

```sql
-- Fontes de dados conectadas
CREATE TABLE integration_sources (
  id UUID PRIMARY KEY,
  name VARCHAR(255) UNIQUE,           -- "Pipedrive", "Clairis", "WhatsApp", etc
  type VARCHAR(50),                   -- "CRM", "ERP", "AGENDA", "FINANCE", "MARKETING"
  enabled BOOLEAN DEFAULT false,
  connector_class VARCHAR(255),       -- "PipedriveDataSource", "ClairisDataSource", etc
  config JSONB,                       -- configurações específicas
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Execução de sincronizações
CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY,
  source_id UUID REFERENCES integration_sources(id),
  status VARCHAR(50),                 -- "pending", "running", "success", "failed"
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_ms INTEGER,
  records_processed INTEGER,
  records_created INTEGER,
  records_updated INTEGER,
  records_deleted INTEGER,
  error_message TEXT,
  created_at TIMESTAMP
);

-- Histórico de todas as sincronizações
CREATE TABLE sync_history (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES sync_jobs(id),
  source_id UUID REFERENCES integration_sources(id),
  action VARCHAR(50),                 -- "created", "updated", "deleted"
  entity_type VARCHAR(50),            -- "patient", "appointment", "deal", etc
  external_id VARCHAR(255),           -- ID no sistema externo
  internal_id UUID,                   -- ID no Executive OS
  payload_before JSONB,
  payload_after JSONB,
  created_at TIMESTAMP
);
```

### Grupo 2: Auditoria & Mudanças

```sql
-- Lotes diários de auditoria
CREATE TABLE audit_batches (
  id UUID PRIMARY KEY,
  batch_date DATE,                    -- data da auditoria
  status VARCHAR(50),                 -- "pending", "processed", "finalized"
  total_changes INTEGER,
  approved_changes INTEGER,
  rejected_changes INTEGER,
  conflicts_found INTEGER,
  created_by UUID,
  created_at TIMESTAMP,
  finalized_at TIMESTAMP
);

-- Itens individuais de auditoria
CREATE TABLE audit_items (
  id UUID PRIMARY KEY,
  batch_id UUID REFERENCES audit_batches(id),
  entity_type VARCHAR(50),            -- "patient", "appointment", "deal", etc
  entity_id UUID,                     -- ID do registro
  change_type VARCHAR(50),            -- "created", "updated", "deleted", "conflict"
  field_name VARCHAR(255),            -- campo afetado
  old_value TEXT,
  new_value TEXT,
  source_id UUID REFERENCES integration_sources(id),
  confidence_score DECIMAL(3,2),      -- 0.00 a 1.00
  status VARCHAR(50),                 -- "pending", "approved", "rejected", "ignored"
  impact_level VARCHAR(50),           -- "critical", "high", "medium", "low"
  suggested_action TEXT,
  requires_approval BOOLEAN DEFAULT false,
  user_responsible UUID,
  approver_id UUID,
  approved_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Logs detalhados de auditoria
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  batch_id UUID REFERENCES audit_batches(id),
  event_type VARCHAR(50),             -- "sync_started", "sync_completed", "error", etc
  message TEXT,
  details JSONB,
  severity VARCHAR(50),               -- "info", "warning", "error", "critical"
  created_at TIMESTAMP
);

-- Regras de auditoria customizáveis
CREATE TABLE audit_rules (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  entity_type VARCHAR(50),            -- "patient", "appointment", etc
  field_name VARCHAR(255),            -- campo a auditar (null = todas)
  condition JSONB,                    -- {"operator": "equals", "value": "..."}
  impact_level VARCHAR(50),           -- "critical", "high", "medium", "low"
  requires_approval BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Grupo 3: Aprovação & Workflow

```sql
-- Fila de aprovação
CREATE TABLE approval_queue (
  id UUID PRIMARY KEY,
  audit_item_id UUID REFERENCES audit_items(id),
  status VARCHAR(50),                 -- "pending", "approved", "rejected"
  created_at TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by UUID,
  review_comment TEXT,
  priority VARCHAR(50)                -- "high", "medium", "low"
);

-- Histórico de aprovações
CREATE TABLE approval_history (
  id UUID PRIMARY KEY,
  approval_id UUID REFERENCES approval_queue(id),
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  changed_by UUID,
  comment TEXT,
  changed_at TIMESTAMP
);
```

### Grupo 4: Jornada do Paciente

```sql
-- Status principal do paciente
CREATE TABLE patient_status (
  id UUID PRIMARY KEY,
  patient_id UUID,                    -- ID centralizado do paciente
  current_stage VARCHAR(100),         -- "Novo Lead", "Agendado", "Em Tratamento", etc
  sub_stage VARCHAR(100),             -- refinamento de stage
  is_duplicate BOOLEAN DEFAULT false,
  has_conflicts BOOLEAN DEFAULT false,
  priority_level VARCHAR(50),         -- "🔴 crítico", "🟠 alto", "🟡 médio", "🟢 baixo"
  last_contact_date TIMESTAMP,
  days_without_contact INTEGER,
  status_changed_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Timeline completa da jornada
CREATE TABLE patient_timeline (
  id UUID PRIMARY KEY,
  patient_id UUID,
  event_type VARCHAR(50),             -- "lead_created", "appointment_scheduled", etc
  event_date TIMESTAMP,
  source_id UUID REFERENCES integration_sources(id),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP
);

-- Perguntas respondidas sobre a jornada
CREATE TABLE patient_journey_facts (
  id UUID PRIMARY KEY,
  patient_id UUID,
  fact_key VARCHAR(100),              -- "exists", "has_duplicates", "has_future_appointment"
  fact_value BOOLEAN,
  confidence_score DECIMAL(3,2),
  last_verified TIMESTAMP,
  source_id UUID REFERENCES integration_sources(id),
  UNIQUE(patient_id, fact_key)
);
```

### Grupo 5: Comparação & Conflitos

```sql
-- Registros comparados entre fontes
CREATE TABLE data_comparison (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50),            -- "patient", "appointment", etc
  entity_id UUID,
  source1_id UUID REFERENCES integration_sources(id),
  source2_id UUID REFERENCES integration_sources(id),
  source1_data JSONB,
  source2_data JSONB,
  matching_score DECIMAL(3,2),        -- 0.00 a 1.00
  matching_strategy VARCHAR(100),     -- "exact_id", "phone", "email", "fuzzy_name"
  last_compared_at TIMESTAMP,
  created_at TIMESTAMP
);

-- Conflitos detectados
CREATE TABLE data_conflicts (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50),
  entity_id UUID,
  field_name VARCHAR(255),
  source1_id UUID REFERENCES integration_sources(id),
  source1_value TEXT,
  source2_id UUID REFERENCES integration_sources(id),
  source2_value TEXT,
  confidence_score DECIMAL(3,2),
  conflict_type VARCHAR(50),          -- "mismatch", "missing_in_one", "inconsistent_format"
  resolution_status VARCHAR(50),      -- "unresolved", "approved", "rejected", "auto_resolved"
  resolution_value TEXT,
  created_at TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Histórico de mudanças em registros
CREATE TABLE data_changes (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50),
  entity_id UUID,
  change_from JSONB,
  change_to JSONB,
  change_reason VARCHAR(255),
  changed_by UUID,
  changed_at TIMESTAMP,
  source_id UUID REFERENCES integration_sources(id),
  is_approved BOOLEAN
);
```

### Grupo 6: Normalização

```sql
-- Regras de normalização
CREATE TABLE normalization_rules (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50),
  field_name VARCHAR(255),
  data_type VARCHAR(50),              -- "phone", "email", "cpf", "date", "currency", etc
  normalize_function VARCHAR(255),    -- "normalize_phone", "normalize_email", etc
  input_pattern VARCHAR(255),         -- regex ou exemplo
  output_pattern VARCHAR(255),        -- formato de saída
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Histórico de normalizações aplicadas
CREATE TABLE normalization_history (
  id UUID PRIMARY KEY,
  rule_id UUID REFERENCES normalization_rules(id),
  entity_id UUID,
  entity_type VARCHAR(50),
  raw_value TEXT,
  normalized_value TEXT,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP
);
```

---

## 🔌 Arquitetura de Data Sources

### Interface Principal (Abstração)

```typescript
// backend/src/domain/data-sources/IDataSource.ts

export interface IDataSource {
  // Identificação
  getSourceName(): string;  // "Pipedrive", "Clairis", etc
  getSourceType(): DataSourceType;  // "CRM", "ERP", etc
  
  // Conectividade
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  testConnection(): Promise<ConnectionTestResult>;
  
  // CRUD Básico
  getPatientById(id: string): Promise<PatientData | null>;
  getAppointmentById(id: string): Promise<AppointmentData | null>;
  getDealById(id: string): Promise<DealData | null>;
  
  // Listagem
  listPatients(filters?: PatientFilters): Promise<PatientData[]>;
  listAppointments(filters?: AppointmentFilters): Promise<AppointmentData[]>;
  listDeals(filters?: DealFilters): Promise<DealData[]>;
  
  // Sincronização
  syncSince(lastSyncDate: Date): Promise<SyncResult>;
  
  // Metadados
  getSchema(): Promise<SourceSchema>;
  getFieldMappings(): Promise<FieldMapping[]>;
  
  // Capacidades
  supportsRealTimeSync(): boolean;
  supportedEntities(): EntityType[];
}

export enum DataSourceType {
  CRM = "CRM",
  ERP = "ERP",
  AGENDA = "AGENDA",
  FINANCE = "FINANCE",
  MARKETING = "MARKETING",
  MESSAGING = "MESSAGING"
}

export enum EntityType {
  PATIENT = "patient",
  APPOINTMENT = "appointment",
  DEAL = "deal",
  ACTIVITY = "activity",
  CONTACT = "contact",
  TRANSACTION = "transaction"
}
```

### Implementações Futuras (Apenas Estrutura)

```typescript
// backend/src/infrastructure/data-sources/CRMDataSource.ts
export abstract class CRMDataSource implements IDataSource {
  // Implementações específicas para CRM
}

// Futuro: PipedriveDataSource extends CRMDataSource
// Futuro: ClairisDataSource extends CRMDataSource

// backend/src/infrastructure/data-sources/ERPDataSource.ts
export abstract class ERPDataSource implements IDataSource {
  // Implementações específicas para ERP
}

// Futuro: SapDataSource extends ERPDataSource
// Futuro: Oracle DataSource extends ERPDataSource
```

### Factory Pattern para Data Sources

```typescript
// backend/src/infrastructure/data-sources/DataSourceFactory.ts

export class DataSourceFactory {
  private static readonly sources = new Map<string, () => IDataSource>();
  
  static register(name: string, creator: () => IDataSource): void {
    this.sources.set(name, creator);
  }
  
  static create(name: string, config: any): IDataSource {
    const creator = this.sources.get(name);
    if (!creator) {
      throw new Error(`DataSource not found: ${name}`);
    }
    return creator();
  }
  
  static getAvailable(): string[] {
    return Array.from(this.sources.keys());
  }
}

// Inicialização (sem implementações reais ainda)
// DataSourceFactory.register("Pipedrive", () => new PipedriveDataSource());
// DataSourceFactory.register("Clairis", () => new ClairisDataSource());
```

---

## 🔄 Motor de Normalização

```typescript
// backend/src/domain/normalization/NormalizationEngine.ts

export interface NormalizationRule {
  dataType: DataType;
  normalize(value: any): Promise<string>;
  denormalize?(value: string): Promise<any>;
  validate(value: any): Promise<boolean>;
}

export enum DataType {
  PHONE = "phone",
  EMAIL = "email",
  CPF = "cpf",
  DATE = "date",
  CURRENCY = "currency",
  UPPERCASE_NAME = "uppercase_name",
  LOWERCASE_NAME = "lowercase_name",
  FULL_NAME = "full_name",
  STATUS = "status",
  DOCUMENT = "document"
}

export class NormalizationEngine {
  constructor(private rules: Map<DataType, NormalizationRule>) {}
  
  async normalize(value: any, type: DataType): Promise<string> {
    const rule = this.rules.get(type);
    if (!rule) throw new Error(`No rule for: ${type}`);
    return rule.normalize(value);
  }
  
  async normalizeObject(obj: any, schema: NormalizationSchema): Promise<any> {
    const normalized = {};
    for (const [key, type] of Object.entries(schema)) {
      if (obj[key]) {
        normalized[key] = await this.normalize(obj[key], type as DataType);
      }
    }
    return normalized;
  }
}

// Implementações Específicas
export class PhoneNormalizationRule implements NormalizationRule {
  dataType = DataType.PHONE;
  
  async normalize(value: any): Promise<string> {
    // "11 99999-9999" → "11999999999"
    return value.replace(/\D/g, '');
  }
}

export class CPFNormalizationRule implements NormalizationRule {
  dataType = DataType.CPF;
  
  async normalize(value: any): Promise<string> {
    // "123.456.789-00" → "12345678900"
    return value.replace(/\D/g, '');
  }
}

export class EmailNormalizationRule implements NormalizationRule {
  dataType = DataType.EMAIL;
  
  async normalize(value: any): Promise<string> {
    // "User@EXAMPLE.COM" → "user@example.com"
    return value.toLowerCase().trim();
  }
}
```

---

## 🔍 Motor de Comparação

```typescript
// backend/src/domain/comparison/ComparisonEngine.ts

export interface ComparisonStrategy {
  compare(value1: any, value2: any): Promise<ComparisonResult>;
  name: string;
}

export interface ComparisonResult {
  isMatch: boolean;
  score: number;  // 0.00 a 1.00
  confidence: number;
}

export class ComparisonEngine {
  private strategies: Map<string, ComparisonStrategy> = new Map();
  
  registerStrategy(strategy: ComparisonStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }
  
  async compareUsing(
    value1: any,
    value2: any,
    strategyName: string
  ): Promise<ComparisonResult> {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) throw new Error(`Strategy not found: ${strategyName}`);
    return strategy.compare(value1, value2);
  }
  
  async compareRecords(
    record1: any,
    record2: any,
    field: string,
    strategies: string[]
  ): Promise<ComparisonResult> {
    let bestResult = { isMatch: false, score: 0, confidence: 0 };
    
    for (const strategy of strategies) {
      const result = await this.compareUsing(
        record1[field],
        record2[field],
        strategy
      );
      
      if (result.score > bestResult.score) {
        bestResult = result;
      }
    }
    
    return bestResult;
  }
}

// Estratégias de Comparação
export class ExactIDComparisonStrategy implements ComparisonStrategy {
  name = "exact_id";
  
  async compare(id1: string, id2: string): Promise<ComparisonResult> {
    const isMatch = id1 === id2;
    return {
      isMatch,
      score: isMatch ? 1.0 : 0.0,
      confidence: 1.0
    };
  }
}

export class PhoneComparisonStrategy implements ComparisonStrategy {
  name = "phone";
  
  async compare(phone1: string, phone2: string): Promise<ComparisonResult> {
    const normalized1 = phone1.replace(/\D/g, '');
    const normalized2 = phone2.replace(/\D/g, '');
    const isMatch = normalized1 === normalized2;
    return {
      isMatch,
      score: isMatch ? 1.0 : 0.0,
      confidence: isMatch ? 0.95 : 0.0
    };
  }
}

export class FuzzyNameComparisonStrategy implements ComparisonStrategy {
  name = "fuzzy_name";
  
  async compare(name1: string, name2: string): Promise<ComparisonResult> {
    // Implementar Levenshtein ou similar
    const score = this.calculateSimilarity(name1, name2);
    return {
      isMatch: score > 0.85,
      score,
      confidence: score
    };
  }
  
  private calculateSimilarity(a: string, b: string): number {
    // Simplificado - implementar algoritmo completo depois
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    
    if (aLower === bLower) return 1.0;
    if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.9;
    
    // TODO: Implementar Levenshtein distance
    return 0.0;
  }
}
```

---

## 🎯 Motor de Auditoria

```typescript
// backend/src/domain/audit/AuditEngine.ts

export interface AuditRule {
  id: string;
  entityType: EntityType;
  fieldName?: string;
  condition: AuditCondition;
  impactLevel: ImpactLevel;
  requiresApproval: boolean;
  enabled: boolean;
}

export interface AuditCondition {
  operator: "equals" | "not_equals" | "contains" | "missing" | "changed";
  value?: any;
}

export enum ImpactLevel {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low"
}

export class AuditEngine {
  constructor(
    private rules: AuditRule[],
    private normalizationEngine: NormalizationEngine
  ) {}
  
  async auditChange(
    entityType: EntityType,
    oldValue: any,
    newValue: any,
    sourceId: string
  ): Promise<AuditFinding[]> {
    const findings: AuditFinding[] = [];
    
    const applicableRules = this.rules.filter(
      r => r.entityType === entityType && r.enabled
    );
    
    for (const rule of applicableRules) {
      const finding = await this.evaluateRule(
        rule,
        oldValue,
        newValue,
        sourceId
      );
      
      if (finding) {
        findings.push(finding);
      }
    }
    
    return findings;
  }
  
  private async evaluateRule(
    rule: AuditRule,
    oldValue: any,
    newValue: any,
    sourceId: string
  ): Promise<AuditFinding | null> {
    // Lógica de avaliação da regra
    // Retorna null se regra não se aplica
    // Retorna AuditFinding se regra é violada
    
    return {
      ruleId: rule.id,
      impactLevel: rule.impactLevel,
      requiresApproval: rule.requiresApproval,
      message: `Mudança em ${rule.fieldName}`,
      confidenceScore: 0.95,
      sourceId
    };
  }
}

export interface AuditFinding {
  ruleId: string;
  impactLevel: ImpactLevel;
  requiresApproval: boolean;
  message: string;
  confidenceScore: number;
  sourceId: string;
}
```

---

## 🛣️ Motor da Jornada do Paciente

```typescript
// backend/src/domain/patient-journey/PatientJourneyEngine.ts

export enum JourneyStage {
  NEW_LEAD = "Novo Lead",
  SCHEDULED = "Agendado",
  CONFIRMED = "Confirmado",
  ATTENDED = "Compareceu",
  MISSED = "Faltou",
  RESCHEDULED = "Reagendado",
  PENDING_BUDGET = "Orçamento Pendente",
  NEGOTIATING = "Em Negociação",
  BUDGET_CLOSED = "Orçamento Fechado",
  IN_TREATMENT = "Em Tratamento",
  RETURN_PENDING = "Retorno Pendente",
  FOLLOWUP_PENDING = "Follow-up Pendente",
  NO_FUTURE_APPOINTMENT = "Sem Agendamento Futuro",
  DEFAULTER = "Inadimplente",
  LOST_PATIENT = "Paciente Perdido",
  RECOVERED_PATIENT = "Paciente Recuperado",
  JOURNEY_COMPLETE = "Jornada Concluída"
}

export enum PriorityLevel {
  CRITICAL = "🔴 Crítico",
  HIGH = "🟠 Alto",
  MEDIUM = "🟡 Médio",
  LOW = "🟢 Baixo"
}

export interface PatientJourneyFact {
  key: string;
  value: boolean;
  confidence: number;
  sourceId: string;
  lastVerified: Date;
}

export class PatientJourneyEngine {
  constructor(
    private comparisonEngine: ComparisonEngine,
    private auditEngine: AuditEngine
  ) {}
  
  async analyzeJourney(patientData: PatientData): Promise<JourneyAnalysis> {
    const facts = await this.gatherFacts(patientData);
    const stage = await this.determineStage(facts);
    const priority = await this.determinePriority(stage, facts);
    
    return {
      stage,
      priority,
      facts,
      classification: this.classifyJourney(stage),
      lastContactDate: patientData.lastContactDate,
      daysSinceContact: this.calculateDaysSinceContact(patientData.lastContactDate),
      recommendations: await this.generateRecommendations(stage, facts)
    };
  }
  
  private async gatherFacts(patientData: PatientData): Promise<PatientJourneyFact[]> {
    return [
      { key: "exists", value: true, confidence: 1.0, sourceId: "", lastVerified: new Date() },
      { key: "has_duplicates", value: patientData.hasDuplicates, confidence: 0.9, sourceId: "", lastVerified: new Date() },
      { key: "has_conflicts", value: patientData.hasConflicts, confidence: 0.9, sourceId: "", lastVerified: new Date() },
      { key: "has_future_appointment", value: !!patientData.nextAppointment, confidence: 0.95, sourceId: "", lastVerified: new Date() },
      // ... mais fatos
    ];
  }
  
  private async determineStage(facts: PatientJourneyFact[]): Promise<JourneyStage> {
    // Lógica de decisão para determinar o estágio atual
    // Baseado nos fatos disponíveis
    return JourneyStage.NEW_LEAD;
  }
  
  private async determinePriority(stage: JourneyStage, facts: PatientJourneyFact[]): Promise<PriorityLevel> {
    // Lógica para priorizar
    if (stage === JourneyStage.LOST_PATIENT) return PriorityLevel.HIGH;
    if (stage === JourneyStage.DEFAULTER) return PriorityLevel.CRITICAL;
    return PriorityLevel.MEDIUM;
  }
  
  private classifyJourney(stage: JourneyStage): string {
    return stage;
  }
  
  private calculateDaysSinceContact(lastContactDate?: Date): number {
    if (!lastContactDate) return -1;
    const now = new Date();
    const diff = now.getTime() - lastContactDate.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
  
  private async generateRecommendations(stage: JourneyStage, facts: PatientJourneyFact[]): Promise<string[]> {
    // IA irá consumir isso futuramente
    return [];
  }
}

export interface JourneyAnalysis {
  stage: JourneyStage;
  priority: PriorityLevel;
  facts: PatientJourneyFact[];
  classification: string;
  lastContactDate?: Date;
  daysSinceContact: number;
  recommendations: string[];
}
```

---

## 📁 Estrutura de Diretórios (Backend)

```
backend/src/
├── domain/                          # Camada de Domínio (regras de negócio)
│   ├── data-sources/
│   │   ├── IDataSource.ts
│   │   ├── DataSourceFactory.ts
│   │   └── entities/
│   ├── normalization/
│   │   ├── NormalizationEngine.ts
│   │   ├── rules/
│   │   └── strategies/
│   ├── comparison/
│   │   ├── ComparisonEngine.ts
│   │   └── strategies/
│   ├── audit/
│   │   ├── AuditEngine.ts
│   │   └── rules/
│   ├── patient-journey/
│   │   ├── PatientJourneyEngine.ts
│   │   ├── JourneyStageResolver.ts
│   │   └── PriorityCalculator.ts
│   └── types/
│
├── application/                     # Camada de Aplicação
│   ├── use-cases/
│   │   ├── audit/
│   │   ├── patient-journey/
│   │   ├── comparison/
│   │   ├── normalization/
│   │   └── approval/
│   ├── dto/
│   ├── mappers/
│   └── services/
│
├── infrastructure/                  # Camada de Infraestrutura
│   ├── persistence/
│   │   ├── repositories/
│   │   ├── typeorm/
│   │   └── queries/
│   ├── data-sources/
│   │   ├── abstract/
│   │   └── implementations/  (futuro)
│   └── external-services/
│
├── presentation/                    # Camada de Apresentação (API)
│   ├── controllers/
│   ├── routes/
│   ├── middlewares/
│   └── validators/
│
└── shared/
    ├── constants/
    ├── errors/
    ├── utils/
    └── decorators/
```

---

## 📱 Estrutura de Rotas (Frontend)

```
frontend/src/
├── dashboards/
│   └── governance/
│       ├── AuditDashboard.tsx           # Dashboard principal de auditoria
│       ├── PatientJourneyPage.tsx       # Jornada do paciente
│       ├── DataComparisonPage.tsx       # Comparação entre sistemas
│       ├── NormalizationPage.tsx        # Status de normalização
│       ├── ConflictPage.tsx             # Conflitos encontrados
│       ├── ApprovalQueuePage.tsx        # Fila de aprovação
│       ├── HistoryPage.tsx              # Histórico completo
│       ├── LogsPage.tsx                 # Logs de sincronização
│       ├── RulesPage.tsx                # Regras de auditoria
│       └── ConfigurationPage.tsx        # Configurações de fontes
│
├── components/governance/
│   ├── audit/
│   │   ├── AuditBatchCard.tsx
│   │   ├── AuditItemTable.tsx
│   │   ├── ConflictIndicator.tsx
│   │   └── ImpactBadge.tsx
│   │
│   ├── patient-journey/
│   │   ├── JourneyTimeline.tsx
│   │   ├── StageBadge.tsx
│   │   ├── PriorityBadge.tsx
│   │   └── PatientFactsList.tsx
│   │
│   ├── comparison/
│   │   ├── ComparisonTable.tsx
│   │   ├── SourceComparison.tsx
│   │   └── SimilarityScore.tsx
│   │
│   ├── approval/
│   │   ├── ApprovalCard.tsx
│   │   ├── ApprovalForm.tsx
│   │   └── DecisionButtons.tsx
│   │
│   └── common/
│       ├── SyncStatusIndicator.tsx
│       ├── SourceBadge.tsx
│       ├── ConfidenceScore.tsx
│       └── ChangeTimeline.tsx
│
├── services/governance/
│   ├── auditService.ts
│   ├── patientJourneyService.ts
│   ├── comparisonService.ts
│   ├── normalizationService.ts
│   ├── approvalService.ts
│   └── dataSourceService.ts
│
└── contexts/governance/
    ├── GovernanceContext.tsx
    ├── AuditContext.tsx
    └── useGovernance.ts
```

---

## 📊 KPIs do Dashboard de Auditoria

```
Registros Analisados (Total)
Registros Novos (período)
Registros Alterados (período)
Registros Excluídos (período)

Conflitos Encontrados (total)
Possíveis Duplicidades (total)

Alterações Pendentes (fila)
Alterações Aprovadas (período)
Alterações Rejeitadas (período)

Sincronizações Executadas (período)
Falhas de Sincronização (período)
Tempo Médio de Sincronização

Fontes Conectadas (ativas)
Integridade de Dados (%)
Taxa de Aprovação (%)
```

---

## 🔐 Princípios de Implementação

### DO's ✅
- [x] Usar mock data em 100% das telas
- [x] Criar arquitetura desacoplada
- [x] Implementar repositórios para cada entidade
- [x] Usar interfaces para abstrações
- [x] Preparar factory patterns
- [x] Documentar pontos de extensão
- [x] Não quebrar nada existente
- [x] Seguir padrões já existentes no projeto

### DON'Ts ❌
- [ ] Não criar integrações reais (Pipedrive, Clairis, etc)
- [ ] Não alterar dashboards existentes
- [ ] Não criar dependências diretas com fornecedores
- [ ] Não remover componentes
- [ ] Não fazer refactoring desnecessário
- [ ] Não usar dados reais do Pipedrive nesta fase

---

## 📅 Roadmap de Implementação

### Semana 1: Banco de Dados & Modelos
- [ ] Criar esquema SQL completo
- [ ] Definir entidades TypeORM
- [ ] Criar repositórios base

### Semana 2: Engines & Serviços
- [ ] Implementar NormalizationEngine
- [ ] Implementar ComparisonEngine
- [ ] Implementar AuditEngine
- [ ] Implementar PatientJourneyEngine

### Semana 3: Backend API
- [ ] Criar controllers para auditoria
- [ ] Criar controllers para jornada
- [ ] Implementar endpoints com mocks

### Semana 4: Frontend Interface
- [ ] Criar rotas e páginas
- [ ] Implementar componentes
- [ ] Integrar com mock services

### Semana 5: Polish & Testing
- [ ] E2E testing
- [ ] Performance validation
- [ ] Documentação final

---

## ✨ Resultado Esperado

Ao final desta fase, o Executive OS terá:

✅ Uma **Camada de Governança de Dados** completamente desacoplada
✅ **8 Páginas funcionais** com dados mockados
✅ **Arquitetura pronta** para receber integrações reais
✅ **Motores de negócio** (normalização, comparação, auditoria, jornada)
✅ **Banco de dados preparado** para múltiplas fontes
✅ **Abstrações e interfaces** bem definidas
✅ **Zero dependências** de fornecedores específicos
✅ **100% das funcionalidades** documentadas

Quando integração real começar (Ex: Clairis), bastará:
1. Implementar `ClairisDataSource extends CRMDataSource`
2. Registrar no `DataSourceFactory`
3. Substituir mocks por dados reais
4. Toda a arquitetura continua funcionando

---

**Documento de Planejamento Estratégico**  
**Autor**: Claude Haiku 4.5  
**Data**: 2026-07-15  
**Branch**: claude/reinice-ren84r
