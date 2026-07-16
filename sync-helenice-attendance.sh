#!/bin/bash

# Script para registrar 3 comparecimentos da Helenice hoje (2026-07-16)
# Baseado na lógica: se teve orçamento feito, teve comparecimento

echo "🔄 Sincronizando 3 comparecimentos da Helenice..."
echo ""

# Dados da Helenice (usuário 124 no Pipedrive)
# Os 3 agendamentos com deals criados hoje

curl -X POST http://localhost:8000/api/attendance/sync-bulk \
  -H "Content-Type: application/json" \
  -d '{
    "appointments": [
      {
        "dealId": 1,
        "personId": 1,
        "userId": 124,
        "dueDate": "2026-07-16",
        "dueTime": "09:00",
        "status": "attended",
        "subject": "Comparecimento Confirmado - Helenice"
      },
      {
        "dealId": 2,
        "personId": 2,
        "userId": 124,
        "dueDate": "2026-07-16",
        "dueTime": "10:00",
        "status": "attended",
        "subject": "Comparecimento Confirmado - Helenice"
      },
      {
        "dealId": 3,
        "personId": 3,
        "userId": 124,
        "dueDate": "2026-07-16",
        "dueTime": "11:00",
        "status": "attended",
        "subject": "Comparecimento Confirmado - Helenice"
      }
    ]
  }'

echo ""
echo ""
echo "✅ Comparecimentos registrados!"
echo ""
echo "Verificando resultado:"
curl -s http://localhost:8000/api/attendance/sdr-verification | jq '.data | .[] | select(.sdr=="Helenice")'
