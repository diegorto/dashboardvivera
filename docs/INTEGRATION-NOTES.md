# Notas de Integração - Vivera Executive OS

## Pipedrive Integration

### Deal Journey Tracking
**Informação Crítica**: Para descobrir quando um deal (paciente):
- ✅ **Agendou** (Scheduled)
- ✅ **Compareceu** (Attended)  
- ✅ **Faltou** (No-show)

**Use**: As atividades CONCLUÍDAS do deal como source de verdade.

```javascript
// Pseudo-código para integração
const activities = await pipedrive.deals.getActivities(dealId);
const completedActivities = activities.filter(a => a.status === 'COMPLETED');

completedActivities.forEach(activity => {
  if (activity.type === 'call' && activity.subject.includes('agendamento')) {
    timeline.add({ type: 'scheduled', date: activity.doneDate });
  }
  if (activity.type === 'call' && activity.subject.includes('comparecimento')) {
    timeline.add({ type: 'attended', date: activity.doneDate });
  }
  if (activity.type === 'call' && activity.subject.includes('falta')) {
    timeline.add({ type: 'no_show', date: activity.doneDate });
  }
});
```

### Campos Importantes no Pipedrive
- `activities[]` - Array de atividades do deal
- `activities[].type` - Tipo (call, meeting, task, etc)
- `activities[].status` - Status (COMPLETED, PENDING, etc)
- `activities[].doneDate` - Data de conclusão (usar para timeline)
- `activities[].subject` - Descrição (pode conter keywords)

### Mapping para PatientTimeline
```
Pipedrive Activity → PatientTimeline Event

deal.activities (completed) → PatientTimeline.eventType
  - 'scheduled' → APPOINTMENT_SCHEDULED
  - 'attended' → APPOINTMENT_COMPLETED
  - 'no_show' → APPOINTMENT_MISSED
```

### Mapping para PatientStatus
```
Usar atividades completas para determinar:
- currentStage (baseado na última atividade completada)
- lastContactDays (data da última atividade)
- stageDuration (diferença entre primeira e última atividade do stage)
```

---

## Clairis Integration

### Dados Clínicos
- Procedimentos realizados
- Data de procedimento
- Pós-operatório
- Alta médica

### Timeline Eventos
Clairis fornece os eventos clínicos:
- `PROCEDURE_SCHEDULED`
- `PROCEDURE_COMPLETED`
- `POST_OP_STARTED`
- `POST_OP_COMPLETED`
- `DISCHARGE`

---

## WhatsApp Integration

### Eventos de Comunicação
- Primeira mensagem recebida
- Última mensagem recebida
- Missed calls
- Conversation duration

### Timeline Eventos
- `WHATSAPP_FIRST_MESSAGE`
- `WHATSAPP_LAST_MESSAGE`
- `WHATSAPP_CALL_RECEIVED`
- `WHATSAPP_CALL_MISSED`

---

## Data Normalization

Ao receber dados de múltiplas fontes:
1. Normalizar datas (ISO 8601)
2. Normalizar telefones
3. Normalizar nomes (capitalização)
4. Detectar duplicatas (score > 80%)
5. Resolver conflitos (scoring por confiabilidade da fonte)

---

## Future Enhancements

### Fase 11+
- [ ] Real-time sync com Pipedrive via Webhooks
- [ ] Real-time sync com Clairis via API
- [ ] WhatsApp Business API integration
- [ ] Automatic conflict resolution (ML-based)
- [ ] Predictive patient journey (IA)
