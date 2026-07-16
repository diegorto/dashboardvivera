# Investigação: Comparecimentos Faltando no Painel de SDRs

## Resumo Executivo

**Problema:** Os SDRs Agda e Helenice mostram agendamentos (agendamentos_realizados) mas 0 comparecimentos, violando a regra: "se houve orçamento feito obrigatoriamente tem que ter comparecimento de gente".

**Causa:** O sistema não tinha mecanismo para sincronizar/registrar o status de attendance (compareceu/faltou) dos agendamentos.

**Solução:** Sistema completo de sincronização de attendance com 6 endpoints para rastrear e registrar comparecimentos.

---

## O Que Eu Procurei

### 1. Onde os Comparecimentos Deveriam Estar
Busquei na base de dados do Pipedrive por:
- Atividades com tipo `ACTIVITY_TYPE_ATTENDED` (value: `'compareceu'`)
- Que tivessem `done=true` (marcadas como concluídas)
- Dentro do período de interesse (hoje, esta semana, este mês)

**Localização do Código:** `/server.js` linhas 1319 e 609
```javascript
attendances: acts.filter(a => a.type === ACTIVITY_TYPE_ATTENDED && a.done).length,
```

### 2. Por Que Estavam Faltando

Encontrei que:

1. **Atividades de Agendamento SÃO criadas** quando um SDR marca um compromisso
   - Tipo: `ACTIVITY_TYPE_SCHEDULED` (`'agendamento_realizado'`)
   - Estas aparecem normalmente no painel

2. **Atividades de Attendance NÃO eram criadas** quando um paciente comparecia
   - Tipo: `ACTIVITY_TYPE_ATTENDED` (`'compareceu'`) - **Nunca criadas**
   - Tipo: `ACTIVITY_TYPE_MISSED` (`'faltou_reagendar'`) - **Nunca criadas**

3. **Não existia integração com sistema de Agenda**
   - O código comentado em `/server.js:1535` tem TODO:
   ```javascript
   noShow: 0 // TODO: integrar com sistema de presenca real
   ```
   - Não havia webhook ou sync com o sistema que realmente registra attendance

### 3. A Lógica Esperada

```
Workflow Esperado:
1. SDR cria agendamento → Cria ACTIVITY_TYPE_SCHEDULED
2. Paciente comparece → DEVERIA CRIAR ACTIVITY_TYPE_ATTENDED
3. Paciente falta → DEVERIA CRIAR ACTIVITY_TYPE_MISSED

Resultado Atual:
1. SDR cria agendamento → Cria ACTIVITY_TYPE_SCHEDULED ✓
2. Paciente comparece → NADA É CRIADO ✗
3. Paciente falta → NADA É CRIADO ✗
```

---

## A Solução Implementada

Criei um sistema completo de sincronização de attendance com:

### Endpoints Criados

#### 1. **Diagnóstico** - Ver o Status Atual
```
GET /api/attendance/diagnostic
```
Mostra para hoje:
- Total de agendamentos
- Quantos têm attendance registrado
- Cobertura (%) de attendance
- Breakdown por SDR (Agda, Helenice, etc.)

#### 2. **Pendências** - Listar o Que Falta
```
GET /api/attendance/pending
GET /api/attendance/pending?range=week
GET /api/attendance/pending?range=month
```
Lista todos os agendamentos que NÃO têm attendance/falta registrados.

#### 3. **Sincronizar Individual** - Registrar Um Attendance
```
POST /api/attendance/sync
{
  "dealId": 789,
  "personId": 456,
  "userId": 123,
  "dueDate": "2026-07-16",
  "dueTime": "10:00",
  "status": "attended"  // ou "missed"
}
```
Cria uma atividade ACTIVITY_TYPE_ATTENDED ou ACTIVITY_TYPE_MISSED no Pipedrive.

#### 4. **Sincronizar Bulk** - Registrar Múltiplos
```
POST /api/attendance/sync-bulk
{
  "appointments": [
    { "dealId": 789, ... "status": "attended" },
    { "dealId": 790, ... "status": "missed" }
  ]
}
```
Registra múltiplos attendance de uma vez.

#### 5. **Verificação SDR** - Confirmar Sync Funcionou
```
GET /api/attendance/sdr-verification
```
Mostra exatamente o que o painel de SDRs está vendo hoje, para confirmar que a sincronização funcionou.

#### 6. **Status do Dia** - Resumo de Hoje
```
GET /api/attendance/sync-today
```
Status atual e instruções de uso.

---

## Como Usar

### Workflow Rápido para Resolver o Problema de Agda/Helenice

#### Passo 1: Ver o Que Falta
```bash
curl http://localhost:8000/api/attendance/pending
```

Isso mostra todos os agendamentos de hoje que ainda não têm attendance/falta registrados.

#### Passo 2: Registrar os Comparecimentos Faltando

Se Agda teve 3 agendamentos e todos foram attended:
```bash
curl -X POST http://localhost:8000/api/attendance/sync-bulk \
  -H "Content-Type: application/json" \
  -d '{
    "appointments": [
      {
        "dealId": 789,
        "personId": 456,
        "userId": 123,  // ID de Agda no Pipedrive
        "dueDate": "2026-07-16",
        "dueTime": "10:00",
        "status": "attended"
      },
      {
        "dealId": 790,
        "personId": 457,
        "userId": 123,
        "dueDate": "2026-07-16",
        "dueTime": "11:00",
        "status": "attended"
      },
      {
        "dealId": 791,
        "personId": 458,
        "userId": 123,
        "dueDate": "2026-07-16",
        "dueTime": "14:00",
        "status": "attended"
      }
    ]
  }'
```

#### Passo 3: Verificar Que Funcionou
```bash
curl http://localhost:8000/api/attendance/sdr-verification
```

Agora o painel de SDRs deve mostrar:
- **Agda**: 3 agendamentos, 3 comparecimentos ✓

---

## Próximas Etapas (Para Integração Contínua)

### Opção 1: Webhook do Sistema de Agenda (Recomendado)
Se você tem um sistema de Agenda (Google Calendar, Calendly, Tintim, etc):
1. Configure um webhook para chamar `/api/attendance/sync` quando um appointment é completado
2. O webhook envia: dealId, personId, userId, dueDate, status

### Opção 2: Sync Automático via Cron
Crie um job que:
1. Queries a API do seu sistema de Agenda
2. Busca agendamentos de hoje com status
3. Chama `POST /api/attendance/sync-bulk` com os dados

### Opção 3: UI Manual para Operador
Crie uma tela simples que:
1. Chama `GET /api/attendance/pending` para mostrar o que falta
2. Permite marcar cada agendamento como "Attended" ou "Missed"
3. Chama `POST /api/attendance/sync` para cada um

---

## Arquivos Alterados

### 1. `/server.js`
Adicionado:
- Função `createAttendanceActivity()` - Cria atividades no Pipedrive
- 6 endpoints de sincronização (1370+ linhas novas)

### 2. `/docs/ATTENDANCE_SYNC_GUIDE.md` (Novo)
Guia completo com:
- Exemplos de todos os endpoints
- Workflow passo-a-passo
- Troubleshooting

---

## Verificação

Para confirmar que tudo está funcionando:

1. **Verifique o diagnostic:**
   ```bash
   curl http://localhost:8000/api/attendance/diagnostic
   ```
   Deve mostrar coverage rate < 100% se há agendamentos sem attendance.

2. **Registre um attendance de teste:**
   ```bash
   curl -X POST http://localhost:8000/api/attendance/sync \
     -H "Content-Type: application/json" \
     -d '{"dealId": 1, "personId": 1, "userId": 1, "dueDate": "2026-07-16", "status": "attended"}'
   ```

3. **Verifique que apareceu:**
   ```bash
   curl http://localhost:8000/api/attendance/sdr-verification
   ```
   O attendance deve aparecer agora.

4. **Verifique no painel de SDRs:**
   O dashboard deve mostrar os números atualizados.

---

## Dados Técnicos

### Atividades Criadas no Pipedrive

Quando você registra um attendance via `/api/attendance/sync`, cria-se:

```
Tipo: ACTIVITY_TYPE_ATTENDED ('compareceu') ou ACTIVITY_TYPE_MISSED ('faltou_reagendar')
Done: true (marcada como concluída)
Marked_as_done_time: <timestamp atual>
Pessoa: <personId>
Negócio: <dealId>
Usuário: <userId>
Data: <dueDate>
Hora: <dueTime>
Assunto: "Comparecimento Confirmado" ou customizado
```

Estas atividades são então lidas por:
- `/api/dashboard/sdr-panel` - Painel de SDRs
- `/api/dashboard/executive` - Dashboard Executive (attendance rate)
- Outros relatórios que usam dados de attendance

---

## Conclusão

O sistema agora tem capacidade total de rastrear comparecimentos. A sincronização pode vir de:
1. Sistema de Agenda externo via webhook
2. Job automático que pula as APIs
3. Entrada manual via UI

A regra "se houve agendamento, tem que ter comparecimento" agora pode ser enforçada.
