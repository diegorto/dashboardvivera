# Camada de Governança de Dados - Guia de Integração

**Status**: ✅ Arquitetura Completa Implementada  
**Data**: 2026-07-15  
**Branch**: `claude/reinice-ren84r`

---

## 📋 O que foi entregue

### Arquitetura em Camadas (Clean Architecture)

```
Apresentação (Routes/Controllers)
    ↓
Aplicação (Services)
    ↓
Domínio (Entities & Business Logic)
    ↓
Infraestrutura (Repositories & Data Sources)
```

### Componentes Implementados

#### 1. Camada de Domínio ✅
**Entidades** (`backend/src/domain/entities/`):
- `IntegrationSource.ts` - Fonte de dados (Pipedrive, Clairis, WhatsApp, etc)
- `AuditBatch.ts` - Lote diário de auditoria
- `AuditItem.ts` - Item individual auditado
- `PatientStatus.ts` - Status e prioridade do paciente
- `PatientTimeline.ts` - Timeline de eventos
- `DataConflict.ts` - Conflitos entre fontes
- `ApprovalQueue.ts` - Fila de aprovação

**Contratos/Interfaces** (`backend/src/domain/contracts/`):
- `IDataSource.ts` - Interface para todas as fontes de dados
- `IRepository.ts` - Interfaces para repositórios

#### 2. Infraestrutura ✅
**Repositórios Mock** (`backend/src/infrastructure/repositories/`):
- `MockAuditRepository.ts` - Dados de auditoria (5 lotes, 50 itens)
- `MockPatientRepository.ts` - Status de 100 pacientes, 500 eventos
- `MockConflictAndApprovalRepository.ts` - 30 conflitos, 20 aprovações

**Factory** (`backend/src/infrastructure/factories/`):
- `RepositoryFactory.ts` - Cria repositórios (Singleton + Fresh)

#### 3. Aplicação ✅
**Services** (`backend/src/application/services/`):
- `GovernanceService.ts` - Lógica de negócio (18 métodos)

#### 4. Apresentação ✅
**Routes** (`backend/src/presentation/routes/`):
- `governance.routes.ts` - 14 endpoints Express

---

## 🔌 Integração no Express Existente

### Passo 1: Adicionar Imports no server.js

```javascript
// server.js (topo do arquivo)
import governanceRoutes from './src/presentation/routes/governance.routes.js';

// Ou com require (se usando CommonJS):
// const governanceRoutes = require('./src/presentation/routes/governance.routes.ts');
```

### Passo 2: Registrar Rotas

```javascript
// server.js (após outras rotas)
app.use('/api/governance', governanceRoutes);

// Exemplo completo de como ficaria:
// app.use('/api/dashboard', dashboardRoutes);
// app.use('/api/marketing', marketingRoutes);
// app.use('/api/governance', governanceRoutes);  // ← Nova
```

### Passo 3: Testar Endpoints

```bash
# Health check
curl http://localhost:3001/api/governance/health

# Dashboard KPIs
curl http://localhost:3001/api/governance/audit/kpis

# Jornada do paciente
curl http://localhost:3001/api/governance/patient-journey/patient_1

# Conflitos não resolvidos
curl http://localhost:3001/api/governance/conflicts/unresolved

# Aprovações pendentes
curl http://localhost:3001/api/governance/approvals/pending
```

---

## 📊 Endpoints Disponíveis

### Auditoria
```
GET /api/governance/audit/kpis
  Response: {
    totalRecordsAnalyzed, newRecords, modifiedRecords,
    deletedRecords, conflictsFound, possibleDuplicates,
    pendingApprovals, approvedChanges, rejectedChanges,
    executedSyncs, failedSyncs, avgSyncTime,
    connectedSources, dataIntegrity, approvalRate
  }

GET /api/governance/audit/stats?days=30
  Response: {
    totalBatches, totalChanges, avgChangesPerBatch,
    approvalRate, conflictRate, batchesByStatus
  }
```

### Jornada do Paciente
```
GET /api/governance/patient-journey/:patientId
  Response: {
    patientId, currentStage, priority, isDuplicate,
    hasConflicts, lastContactDays, totalEvents,
    stageDuration, recentEvents
  }

GET /api/governance/patient-journey/stage/:stage
  Response: Array<PatientJourneyDTO>

GET /api/governance/patient-journey/priority-high?limit=10
  Response: Array<PatientJourneyDTO> (top 10)
```

### Conflitos
```
GET /api/governance/conflicts/unresolved
  Response: Array<ConflictDTO>

POST /api/governance/conflicts/:conflictId/resolve
  Body: { resolutionValue: "value" }
  Response: { success, message }
```

### Aprovações
```
GET /api/governance/approvals/pending
  Response: Array<ApprovalItemDTO> + count + overdue

POST /api/governance/approvals/:approvalId/approve
  Body: { userId: "user_123" }
  Response: { success, message }

POST /api/governance/approvals/:approvalId/reject
  Body: { userId: "user_123" }
  Response: { success, message }
```

### Health
```
GET /api/governance/health
  Response: { status: "running" }
```

---

## 🎯 Dados Mockados Disponíveis

Todos os repositórios já vêm com dados simulados realistas:

### MockAuditBatchRepository
- 5 lotes de auditoria
- Datas variadas (últimos 5 dias)
- Status: pending, processing, finalized
- 70-150 mudanças por lote

### MockAuditItemRepository
- 50 itens de auditoria
- Distribuição: 70% pending, 20% approved, 10% rejected
- Impacto: 5% crítico, 10% alto, 35% médio, 50% baixo
- Entity types: patient, appointment, deal, activity

### MockPatientStatusRepository
- 100 pacientes
- Estágios aleatórios da jornada
- 5% com duplicatas
- 10% com conflitos
- Prioridades calculadas automaticamente

### MockPatientTimelineRepository
- 500 eventos (5 por paciente em média)
- Distribuição de eventos variada
- Datas nos últimos 90 dias
- Metadata com IDs externos

### MockDataConflictRepository
- 30 conflitos
- Types: mismatch (60%), missing (30%), format (10%)
- Status: 60% unresolved, 30% approved, 10% rejected

### MockApprovalQueueRepository
- 20 itens em fila
- Prioridades: HIGH, MEDIUM, LOW
- Status: 75% pending, 20% approved, 5% rejected
- Alguns com "overdue" (>7 dias)

---

## 🔄 Fluxo de Dados

### Exemplo: Requisição de Dashboard de Auditoria

```
1. Cliente (React)
   ↓
2. GET /api/governance/audit/kpis
   ↓
3. Express Router (governance.routes.ts)
   ↓
4. GovernanceService.getAuditDashboardKPIs()
   ↓
5. RepositoryFactory.getInstance()
   ↓
6. MockAuditItemRepository + MockAuditBatchRepository + ...
   ↓
7. Calcula estatísticas agregadas
   ↓
8. Retorna AuditDashboardKPIs JSON
   ↓
9. React renderiza dados
```

---

## 📱 Como Consumir no Frontend

### Exemplo com React

```typescript
// frontend/src/services/governanceService.ts
import api from './api';

export class GovernanceService {
  async getAuditKPIs() {
    const response = await api.get('/governance/audit/kpis');
    return response.data.data;
  }

  async getPatientJourney(patientId: string) {
    const response = await api.get(`/governance/patient-journey/${patientId}`);
    return response.data.data;
  }

  async getUnresolvedConflicts() {
    const response = await api.get('/governance/conflicts/unresolved');
    return response.data.data;
  }

  async getPendingApprovals() {
    const response = await api.get('/governance/approvals/pending');
    return response.data.data;
  }
}
```

### Uso em um Componente

```typescript
// frontend/src/dashboards/governance/AuditDashboard.tsx
import { useEffect, useState } from 'react';
import { governanceService } from '../../services/governanceService';

export default function AuditDashboard() {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await governanceService.getAuditKPIs();
        setKpis(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div>Carregando...</div>;

  return (
    <div>
      <h1>Dashboard de Auditoria</h1>
      <div className="grid">
        <Card title="Registros Analisados" value={kpis.totalRecordsAnalyzed} />
        <Card title="Conflitos" value={kpis.conflictsFound} />
        <Card title="Pendentes" value={kpis.pendingApprovals} />
        <Card title="Integridade" value={`${kpis.dataIntegrity}%`} />
      </div>
    </div>
  );
}
```

---

## 🔄 Transição para Dados Reais

### Quando adicionar integração real (Ex: Clairis)

#### Passo 1: Criar DataSource Implementation
```typescript
// backend/src/infrastructure/data-sources/ClairisDataSource.ts
import { IDataSource } from '../../domain/contracts/IDataSource';

export class ClairisDataSource implements IDataSource {
  async connect(): Promise<void> {
    // Conectar à API real
  }

  async getPatientById(id: string): Promise<PatientData | null> {
    // Buscar em Clairis
  }

  // ... implementar outros métodos
}
```

#### Passo 2: Substituir Mock Repositories
```typescript
// Criar TypeORMRepository que estenda IRepository
export class TypeORMPatientStatusRepository implements IPatientStatusRepository {
  constructor(private dataSource: DataSource) {}

  async findById(id: string): Promise<PatientStatus | null> {
    // Query real do banco de dados
  }

  // ... implementar outros métodos
}
```

#### Passo 3: Atualizar Factory
```typescript
// backend/src/infrastructure/factories/RepositoryFactory.ts
export class RepositoryFactory implements IRepositoryFactory {
  createPatientStatusRepository() {
    // Trocar de MockPatientStatusRepository
    // Para TypeORMPatientStatusRepository
    return new TypeORMPatientStatusRepository(dataSource);
  }
}
```

#### Resultado: ZERO mudanças necessárias
- ✅ Service layer continua igual
- ✅ Routes continue igual
- ✅ Frontend continue igual
- ✅ Apenas repositórios substituídos

---

## 🏗️ Padrões Utilizados

### Clean Architecture
- Domain Layer (Entities, Business Logic)
- Application Layer (Services, Use Cases)
- Infrastructure Layer (Repositories, Data Sources)
- Presentation Layer (Routes, Controllers)

### SOLID Principles
- **S**ingle Responsibility: Cada classe tem uma responsabilidade
- **O**pen/Closed: Aberta para extensão (novos DataSources), fechada para modificação
- **L**iskov Substitution: Todos os DataSources implementam IDataSource
- **I**nterface Segregation: Interfaces específicas por domínio
- **D**ependency Inversion: Depende de abstrações, não implementações

### Design Patterns
- **Repository Pattern**: Abstração de persistência
- **Factory Pattern**: Criação centralizada de repositórios
- **Singleton Pattern**: Reutilizar instâncias
- **Service Layer Pattern**: Lógica de negócio centralizada
- **Dependency Injection**: Injetar dependências

---

## ✅ Checklist de Implementação

- [x] Domain Entities criadas (7)
- [x] Interfaces de contrato definidas
- [x] Mock Repositories implementados (6)
- [x] Service Layer implementada
- [x] Express Routes criadas (14 endpoints)
- [x] Dados mockados realistas
- [x] Sem quebra de código existente
- [x] Pronto para integração real

---

## 🚀 Próximos Passos

### Fase Atual (Concluída ✅)
Criar arquitetura desacoplada + dados mock + API

### Próxima Fase (Frontend)
1. Criar 8 páginas governança (React)
2. Componentes reutilizáveis
3. Consumir endpoints existentes
4. Testes com dados mock

### Fase Seguinte (Integrações)
1. Implementar ClairisDataSource
2. Implementar TypeORMRepositories
3. Conectar banco de dados real
4. Remover mocks, usar dados reais

### Fase Final (Otimização)
1. Implementar cache layer
2. Adicionar sincronização em background
3. Alertas e notificações
4. IA para análise de jornada

---

## 📞 Suporte Técnico

### Perguntas Frequentes

**P: Posso usar isto sem banco de dados?**
R: Sim! Os Mock Repositories funcionam 100% com dados em memória.

**P: Como adicionar nova integração?**
R: Implementar `IDataSource`, registrar no `DataSourceFactory`. Os repositórios trabalharão normalmente.

**P: Os dados são persistidos entre requisições?**
R: Não com Mocks. Com TypeORM + Banco, sim. Trocar é trivial (apenas RepositoryFactory).

**P: Preciso modificar o frontend existente?**
R: Não. A Camada de Governança é totalmente independente.

**P: Como testar localmente?**
R: Rodar `npm start` e acessar endpoints via curl ou Postman.

---

**Arquitetura Completa da Governança de Dados**  
**Pronta para Frontend + Integração com Clairis/WhatsApp/ERP**  
**Nenhuma dependência com Pipedrive ou outro fornecedor específico**
