#!/bin/bash
# Ultra-simples - roda tudo de uma vez

echo "⚡ QUICK FIX - Zerando e recomeçando"

# 1. Matar tudo que tá usando porta 3000
echo "1. Matando processos..."
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
pkill -9 node 2>/dev/null || true
pkill -9 npm 2>/dev/null || true
sleep 3

# 2. Atualizar código
echo "2. Atualizando código..."
cd /root/dashboardvivera
git reset --hard HEAD
git fetch origin
git checkout claude/meta-pipe-api-integration-luq1ht
git reset --hard origin/claude/meta-pipe-api-integration-luq1ht

# 3. Limpar node_modules e reinstalar
echo "3. Limpando e instalando dependências..."
rm -rf node_modules package-lock.json 2>/dev/null || true
npm install --silent 2>&1 | grep -E "added|up to date"

# 4. Iniciar com PM2
echo "4. Iniciando servidor com PM2..."
npm install -g pm2 --silent 2>/dev/null || true

# Config super simples
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{ name: 'dashboard', script: 'server.js', env: { PORT: 3000, NODE_ENV: 'production' } }]
};
EOF

pm2 kill 2>/dev/null || true
sleep 2
pm2 start ecosystem.config.js
pm2 save
pm2 status

echo ""
echo "✅ Pronto! Teste em 5 segundos..."
sleep 5

# Health check
if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
  echo "🎉 SUCESSO! Servidor rodando!"
  echo "📊 Acesse: http://seu-ip:3000/sdr"
else
  echo "⚠️  Servidor não respondeu. Checando logs:"
  pm2 logs --lines 20 --nostream dashboard
fi
