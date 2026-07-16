# Guia de Sincronização de Comparecimentos

## Problema

O painel de SDRs mostrava agendamentos (agendamentos realizados) mas 0 comparecimentos (comparecimentos):

- **Agda**: 3 agendamentos, 0 comparecimentos  
- **Helenice**: 1 agendamento, 0 comparecimentos

Segundo a regra de negócio: "se houve orçamento feito obrigatoriamente tem que ter comparecimento de gente" - ou seja, se foi agendado, deve haver um registro de comparecimento (attended) ou falta (missed).

## Solução

Sistema de sincronização de attendance que cria atividades no Pipedrive para rastrear:
- **ACTIVITY_TYPE_ATTENDED** (`compareceu`): Paciente compareceu ao agendamento
- **ACTIVITY_TYPE_MISSED** (`faltou_reagendar`): Paciente faltou ao agendamento

## Endpoints Disponíveis

### 1. Diagnóstico: Ver Cobertura Atual

```bash
GET /api/attendance/diagnostic
```

Mostra um relatório completo de attendance para hoje:

**Resposta Exemplo:**
```json
{
  "success": true,
  "date": "2026-07-16",
  "summary": {
    "totalScheduled": 4,
    "totalAttended": 1,
    "totalMissed": 0,
    "coverageRate": "25.0"
  },
  "bySDR": [
    {
      "sdr": "Agda",
      "userId": 123,
      "scheduled": 3,
      "attended": 0,
      "missed": 0,
      "appointments": [
        {
          "id": 999,
          "patient": "João Silva",
          "date": "2026-07-16",
          "time": "10:00",
          "deal": "Implante Dentário",
          "subject": "Agendamento Realizado",
          "personId": 456,
          "dealId": 789,
          "userId": 123
        }
      ]
    },
    {
      "sdr": "Helenice",
      "userId": 124,
      "scheduled": 1,
      "attended": 1,
      "missed": 0,
      "appointments": []
    }
  ]
}
```

**Interpretação:**
- Se `coverageRate < 100%`, existem agendamentos sem comparecimento/falta registrados
- No exemplo, 75% dos agendamentos (3 de 4) ainda não têm attendance marcado

### 2. Listar Agendamentos Pendentes

```bash
GET /api/attendance/pending
GET /api/attendance/pending?range=week
GET /api/attendance/pending?range=month
```

**Parâmetros:**
- `range`: `today` (padrão), `week`, ou `month`

**Resposta Exemplo:**
```json
{
  "success": true,
  "range": { "since": "2026-07-16", "until": "2026-07-16" },
  "totalPending": 3,
  "appointments": [
    {
      "activityId": 999,
      "date": "2026-07-16",
      "time": "10:00",
      "sdr": "Agda",
      "userId": 123,
      "patient": "João Silva",
      "dealTitle": "Implante Dentário",
      "dealId": 789,
      "subject": "Agendamento Realizado"
    }
  ]
}
```

### 3. Registrar Attendance Individual

```bash
POST /api/attendance/sync
Content-Type: application/json

{
  "dealId": 789,
  "personId": 456,
  "userId": 123,
  "dueDate": "2026-07-16",
  "dueTime": "10:00",
  "status": "attended",
  "subject": "Comparecimento Confirmado"
}
```

**Campos Obrigatórios:**
- `dealId`: ID da oportunidade no Pipedrive
- `personId`: ID da pessoa (paciente)
- `userId`: ID do usuário (SDR/profissional)
- `dueDate`: Data (YYYY-MM-DD)
- `status`: `"attended"` ou `"missed"`

**Campos Opcionais:**
- `dueTime`: Hora (HH:MM), padrão "09:00"
- `subject`: Descrição personalizada

**Resposta Sucesso:**
```json
{
  "success": true,
  "message": "Atividade de attended criada com sucesso",
  "data": {
    "id": 1234,
    "type": "compareceu",
    "done": true
  }
}
```

### 4. Sincronizar Múltiplas Attendances

```bash
POST /api/attendance/sync-bulk
Content-Type: application/json

{
  "appointments": [
    {
      "dealId": 789,
      "personId": 456,
      "userId": 123,
      "dueDate": "2026-07-16",
      "dueTime": "10:00",
      "status": "attended"
    },
    {
      "dealId": 790,
      "personId": 457,
      "userId": 124,
      "dueDate": "2026-07-16",
      "dueTime": "11:30",
      "status": "missed"
    }
  ]
}
```

**Resposta:**
```json
{
  "success": true,
  "totalProcessed": 2,
  "results": [
    {
      "dealId": 789,
      "status": "attended",
      "success": true,
      "activityId": 1234
    },
    {
      "dealId": 790,
      "status": "missed",
      "success": true,
      "activityId": 1235
    }
  ]
}
```

## Workflow Completo

### Passo 1: Verificar Cobertura Atual
```bash
curl http://localhost:8000/api/attendance/diagnostic
```

### Passo 2: Listar Agendamentos Sem Attendance
```bash
curl http://localhost:8000/api/attendance/pending
```

### Passo 3: Registrar Attendances Faltando

Opção A - Individual:
```bash
curl -X POST http://localhost:8000/api/attendance/sync \
  -H "Content-Type: application/json" \
  -d '{
    "dealId": 789,
    "personId": 456,
    "userId": 123,
    "dueDate": "2026-07-16",
    "dueTime": "10:00",
    "status": "attended"
  }'
```

Opção B - Bulk (Recomendado para múltiplos):
```bash
curl -X POST http://localhost:8000/api/attendance/sync-bulk \
  -H "Content-Type: application/json" \
  -d '{
    "appointments": [
      { "dealId": 789, "personId": 456, "userId": 123, "dueDate": "2026-07-16", "dueTime": "10:00", "status": "attended" },
      { "dealId": 790, "personId": 457, "userId": 123, "dueDate": "2026-07-16", "dueTime": "11:00", "status": "missed" }
    ]
  }'
```

### Passo 4: Verificar Resultado
```bash
curl http://localhost:8000/api/attendance/diagnostic
```

Agora o `coverageRate` deve ser 100% e os comparecimentos devem aparecer no painel de SDRs.

## Integração com Sistemas Externos

Se você tem um sistema de Agenda externo (tipo Calendly, Google Calendar, etc), pode:

1. **Opção 1 - Webhook**: Configurar o sistema de Agenda para chamar `POST /api/attendance/sync` quando um appointment é marcado como attended/missed

2. **Opção 2 - Scheduled Sync**: Criar um cron job que periodicamente:
   - Consulta a API do seu sistema de Agenda
   - Obtém status de attendance para o dia
   - Chama `POST /api/attendance/sync-bulk` com os dados

3. **Opção 3 - Manual**: Usar `/api/attendance/pending` para ver o que falta, e manualmente chamar `POST /api/attendance/sync`

## Dados Criados no Pipedrive

Quando você registra um attendance, uma atividade é criada com:

```
Tipo: "compareceu" (ou "faltou_reagendar" se missed)
Concluída: Sim (done=true)
Hora de Conclusão: Agora
Assunto: "Comparecimento Confirmado" (customizável)
Associada a: Pessoa + Negócio + Usuário
Data: A data do agendamento original
```

## Troubleshooting

### Problema: Endpoint retorna 400 "Parâmetros obrigatórios faltando"

**Solução**: Verifique se todos os campos obrigatórios estão preenchidos:
- `dealId` ✓
- `personId` ✓  
- `userId` ✓
- `dueDate` ✓ (formato YYYY-MM-DD)
- `status` ✓ ("attended" ou "missed")

### Problema: Atividades não aparecem no Pipedrive

**Solução**: 
1. Verifique se `PIPEDRIVE_TOKEN` está correto em `.env`
2. Verifique se os IDs (dealId, personId, userId) são válidos
3. Verifique os logs do servidor para erros

### Problema: Coverage Rate ainda não é 100%

**Solução**: Alguns agendamentos podem ainda estar sem attendance. Use `/api/attendance/pending` para ver quais estão faltando.

## Próximos Passos

- [ ] Integrar com sistema de Agenda real
- [ ] Criar webhook para sincronização automática
- [ ] Adicionar UI para registrar attendance manualmente
- [ ] Configurar backup automático de attendance data
