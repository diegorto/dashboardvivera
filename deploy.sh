#!/bin/bash

# Script de Deploy - Dashboard Vivera
# Uso: ./deploy.sh [docker|manual]

set -e

DEPLOY_TYPE=${1:-docker}
BRANCH="claude/reinice-ren84r"

echo "🚀 Deploy Dashboard Vivera"
echo "Tipo: $DEPLOY_TYPE"
echo "Branch: $BRANCH"
echo ""

# 1. Fazer pull do código
echo "📥 Fazendo pull do código..."
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

# 2. Deploy conforme tipo
if [ "$DEPLOY_TYPE" = "docker" ]; then
  echo "🐳 Deploy via Docker Compose..."

  if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado!"
    exit 1
  fi

  echo "Parando containers antigos..."
  docker compose down || true

  echo "Rebuilding e startando containers..."
  docker compose up -d --build

  echo "Esperando health check..."
  sleep 5

  echo "Verificando logs..."
  docker compose logs --tail 20

  echo "✅ Deploy com Docker concluído!"

elif [ "$DEPLOY_TYPE" = "manual" ]; then
  echo "🛠️ Deploy Manual..."

  echo "Parando servidor antigo..."
  pkill -f "node server.js" || true
  sleep 2

  echo "Instalando dependências..."
  npm install --production

  echo "Startando servidor..."
  NODE_ENV=production nohup node server.js > /tmp/dashboardvivera.log 2>&1 &

  echo "Esperando server ficar pronto..."
  sleep 3

  echo "Últimos logs:"
  tail -20 /tmp/dashboardvivera.log

  echo "✅ Deploy Manual concluído!"

else
  echo "❌ Tipo inválido: $DEPLOY_TYPE"
  echo "Use: ./deploy.sh [docker|manual]"
  exit 1
fi

# 3. Verificação
echo ""
echo "🔍 Verificações Pós-Deploy:"
echo ""

# Test health
if command -v curl &> /dev/null; then
  echo "Testando health check..."
  if curl -s http://localhost:8000/api/health > /dev/null; then
    echo "✅ Health check OK"
  else
    echo "⚠️  Health check falhou - servidor pode estar ainda inicializando"
  fi

  echo ""
  echo "Testando attendance system..."
  if curl -s http://localhost:8000/api/attendance/diagnostic > /dev/null 2>&1; then
    echo "✅ Sistema de attendance operacional"
  else
    echo "⚠️  Sistema de attendance não respondeu"
  fi
else
  echo "⚠️  curl não disponível - pule testes"
fi

echo ""
echo "✅ Deploy finalizado!"
echo ""
echo "Próximas etapas:"
echo "1. Verifique http://seu-servidor:8000 no navegador"
echo "2. Confirme que Google Ads e Meta Ads aparecem no menu lateral"
echo "3. Se precisar sync de attendance, use:"
echo "   curl http://localhost:8000/api/attendance/pending"
