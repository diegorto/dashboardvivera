#!/bin/bash
# Vivera Dashboard - Deploy de atualizações
# Uso no VPS: cd /root/dashboardvivera-prod && ./deploy.sh
set -e

echo "📥 Puxando atualizações..."
git pull origin claude/reinice-ren84r
echo "📌 Versão deployada: $(git log --oneline -1)"

echo "🔨 Rebuild dos containers..."
docker-compose build

echo "🚀 Subindo..."
docker-compose up -d --force-recreate

echo "⏳ Aguardando serviços..."
sleep 5

echo ""
echo "🩺 Verificação:"
curl -s http://localhost:8001/api/health && echo "  <- BACKEND OK"
curl -s "http://localhost:8000/api/dashboard/marketing/creatives" | grep -o '"cpl":[0-9.]*' | head -3 && echo "  <- CPL calculado"
code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000)
echo "$code <- FRONTEND ($([ "$code" = "200" ] && echo OK || echo ERRO))"

echo ""
echo "✅ Deploy concluído: http://187.77.249.55:8000"
