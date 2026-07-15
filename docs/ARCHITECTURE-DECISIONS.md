# Decisões Arquiteturais Críticas

## 🎯 Hierarquia de Fontes de Dados

### ⭐ PIPEDRIVE = ARQUIVO MÃE (Source of Truth)

**Pipedrive é a única fonte de verdade do sistema**

```
PIPEDRIVE (Source of Truth)
    ↓ Dados Primários
    ↓ Usado em 100% dos cálculos
    ↓ Usado em 100% dos dashboards
    ↓ Usado em 100% da jornada
    ↓
CLAIRIS (Validation Only)
    ↓ Verifica se dados estão corretos
    ↓ Identifica inconsistências
    ↓ Alertas de divergências
    ↓ Não substitui Pipedrive
```

### ❌ O que NÃO fazer

- ❌ Não usar Clairis como source de verdade
- ❌ Não fazer merge de dados Pipedrive + Clairis
- ❌ Não criar conflitos de resolução entre fontes
- ❌ Não substituir Pipedrive por Clairis

### ✅ O que FAZER com Clairis

- ✅ Validar dados do Pipedrive
- ✅ Detectar inconsistências
- ✅ Alertar quando há divergências
- ✅ Usar para auditoria/conformidade
- ✅ Rastrear erros de entrada

---

## 📊 Estrutura de Dados

### Pipedrive = Master Data
```
Deal (Paciente)
├── id (source of truth)
├── name
├── phone
├── email
├── stage (journey stage)
└── activities (COMPLETED) ← Key data
    ├── scheduled date
    ├── attended date
    ├── no-show date
    └── timestamps
```

### Clairis = Verification Data
```
Patient Record
├── Same ID as Pipedrive deal
├── Clinical data (procedures, post-op)
└── Alerts if mismatch with Pipedrive
    ├── Different phone?
    ├── Different address?
    ├── Procedure not in Pipedrive?
    └── → Flag for review
```

---

## 🔄 Fluxo de Dados

### Data Flow Correto
```
1. Sincronizar Pipedrive
   └─ Carregar deals, activities, etc
   └─ Armazenar em PatientStatus
   └─ Armazenar em PatientTimeline
   └─ Usar em 100% dos dashboards

2. Sincronizar Clairis (LAST - Optional)
   └─ Carregar dados clínicos
   └─ Comparar com Pipedrive
   └─ Gerar alerts de divergências
   └─ Armazenar em audit log
   └─ Não sobrescrever dados Pipedrive
```

### Integration Priority
```
Phase 1: Pipedrive (CRM) ← FIRST & MAIN
Phase 2: WhatsApp (Communication)
Phase 3: Clairis (Validation) ← LAST
```

---

## 🚨 Regras de Divergência

Se Pipedrive ≠ Clairis:

```javascript
if (pipedrive.data !== clairis.data) {
  // NÃO substituir Pipedrive
  // ALERTAR para revisão manual
  
  audit.log({
    source1: 'Pipedrive',
    source2: 'Clairis',
    field: 'phone',
    value1: pipedrive.phone,
    value2: clairis.phone,
    action: 'KEEP_PIPEDRIVE_ALERT_USER' ← Regra clara
  });
  
  // Mostrar no dashboard de Conflitos
  conflicts.add({
    type: 'VALIDATION_MISMATCH',
    severity: 'warning',
    action: 'USER_REVIEW_NEEDED'
  });
}
```

---

## 📋 Mapeamento Pipedrive → Sistema

### Deal → PatientStatus
```
Pipedrive Deal ────→ PatientStatus
├── deal.id ────→ patientId
├── deal.name ────→ patientName
├── deal.status ────→ currentStage
├── deal.value ────→ ticketValue
├── deal.owner_id ────→ assignedTo
└── deal.activities (completed) ────→ PatientTimeline
```

### Activities (Completed) → Timeline Events
```
Activity Type + Subject ────→ Timeline Event

"Agendamento" ────→ APPOINTMENT_SCHEDULED
"Comparecimento" ────→ APPOINTMENT_COMPLETED
"Falta" ────→ APPOINTMENT_MISSED
"Procedimento" ────→ PROCEDURE_COMPLETED
```

---

## 🔐 Integridade de Dados

### Garantias do Sistema

- ✅ Pipedrive é nunca sobrescrito
- ✅ Clairis é apenas de leitura para validação
- ✅ Conflitos são apenas alertas, não resoluções automáticas
- ✅ Auditoria completa de todas as divergências
- ✅ Histórico de quando divergências apareceram

---

## 🚀 Implicações para Implementação

### Fase 8 (Atual) - Governance Mock
```
✅ Preparar estrutura para Pipedrive
✅ Usar mock data que imita Pipedrive
✅ Testar padrão "Pipedrive is master"
```

### Fase 10 - Pipedrive Integration
```
✅ Conectar Pipedrive API
✅ Sincronizar deals, activities
✅ Popular PatientStatus e PatientTimeline
✅ Usar EXCLUSIVELY para 100% dos dados
```

### Fase 10b - WhatsApp Integration
```
✅ Adicionar channel de comunicação
✅ Usar para validar números Pipedrive
✅ Alertar se números divergentes
```

### Fase 11 - Clairis Integration (LAST)
```
✅ Conectar apenas para validação
✅ NÃO substituir nenhum dado Pipedrive
✅ Gerar alerts de inconsistências
✅ Audit trail completo
✅ Dashboard de conformidade
```

---

## 💡 Por que Pipedrive é Master?

1. **Pipedrive é CRM** - Source oficial de deals/pacientes
2. **Pipedrive tem activities** - Timestamps confiáveis
3. **Pipedrive é único ponto de entrada** - Consistente
4. **Clairis é especializado** - Só dados clínicos
5. **Mais simples** - Não fazer merge complexo

---

## ⚠️ O que Não Fazer

```javascript
// ❌ ERRADO
if (clairis.phone && clairis.phone !== pipedrive.phone) {
  patient.phone = clairis.phone; // ❌ Sobrescreveu Pipedrive!
}

// ✅ CORRETO
if (clairis.phone && clairis.phone !== pipedrive.phone) {
  audit.alert({
    type: 'PHONE_MISMATCH',
    pipedrive: pipedrive.phone,
    clairis: clairis.phone,
    action: 'MANUAL_REVIEW_NEEDED'
  });
  // Pipedrive continua intacto
}
```

---

## 📌 Summary

| Aspecto | Pipedrive | Clairis |
|---------|-----------|---------|
| **Role** | Source of Truth | Validation |
| **Prioridade** | 1ª (Obrigatório) | 3ª (Opcional) |
| **Pode sobrescrever?** | N/A | ❌ Nunca |
| **Tipo de sync** | Master | Audit |
| **Fase de integração** | Phase 10 (Next) | Phase 11 (Last) |
| **Criticidade** | 🔴 Crítico | 🟡 Importante |

---

**Decisão Arquitetural Crítica: Pipedrive sempre vence!**
