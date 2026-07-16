#!/bin/bash

# Script para sincronizar comparecimentos baseado nas atividades pendentes
# Uso: ./sync-attendance.sh

API="http://localhost:8000/api"

echo "🔍 Verificando agendamentos pendentes de comparecimento..."
echo ""

# 1. Obter diagnóstico de attendance
echo "📊 Diagnóstico de Attendance:"
DIAG=$(curl -s $API/attendance/diagnostic)
echo $DIAG | jq '.'

echo ""
echo "---"
echo ""

# 2. Listar agendamentos faltando attendance
echo "📋 Agendamentos pendentes de comparecimento:"
PENDING=$(curl -s "$API/attendance/pending?range=today")
echo $PENDING | jq '.appointments'

echo ""
echo "---"
echo ""

# 3. Instruções para sincronizar
echo "📝 Para sincronizar comparecimentos, use:"
echo ""
echo "curl -X POST $API/attendance/sync-bulk \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"appointments\": ["
echo "      {"
echo "        \"dealId\": <DEAL_ID>,"
echo "        \"personId\": <PERSON_ID>,"
echo "        \"userId\": <USER_ID>,"
echo "        \"dueDate\": \"2026-07-16\","
echo "        \"dueTime\": \"HH:MM\","
echo "        \"status\": \"attended\""
echo "      }"
echo "    ]"
echo "  }'"
echo ""
echo "Para verificar o resultado:"
echo "curl $API/attendance/sdr-verification | jq '.'"
