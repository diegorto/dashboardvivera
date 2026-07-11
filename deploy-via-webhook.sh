#!/bin/bash

# Script para disparar deployment via webhook
# Use: bash deploy-via-webhook.sh

VPS_URL="http://187.77.249.55:3000"
WEBHOOK_URL="$VPS_URL/webhook/github-deploy"

echo "🚀 Disparando webhook de deploy..."
echo "URL: $WEBHOOK_URL"

# Simular payload do GitHub
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "ref": "refs/heads/claude/meta-pipe-api-integration-luq1ht",
    "action": "deployment"
  }' \
  -v

echo ""
echo "✅ Webhook disparado!"
echo ""
echo "Checando status do servidor..."
sleep 3

# Health check
if curl -s "$VPS_URL/api/health" > /dev/null; then
  echo "✅ Servidor respondendo!"
else
  echo "⏳ Servidor ainda iniciando..."
  sleep 5
  if curl -s "$VPS_URL/api/health" > /dev/null; then
    echo "✅ Servidor online!"
  fi
fi

echo ""
echo "📊 Acesse o dashboard:"
echo "   $VPS_URL/"
