#!/bin/bash

################################################################################
# 🤖 DEPLOY AUTOMÁTICO - Cole e execute no VPS
# Execute APENAS UMA VEZ com:
# bash /root/dashboardvivera/deploy.sh
################################################################################

echo ""
echo "🚀 DEPLOY AUTOMÁTICO DO DASHBOARD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Matar tudo
echo "🔪 Limpando portas..."
pkill -f "node server.js" 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
pm2 kill 2>/dev/null || true
sleep 2
echo "✓ Portas limpas"

# 2. Instalar dependências
echo ""
echo "📦 Instalando..."
cd /root/dashboardvivera
npm install --silent 2>/dev/null
echo "✓ Dependências OK"

# 3. Configurar automação
echo ""
echo "⚙️  Configurando automação..."
node setup-automation.js > /dev/null 2>&1 || true
echo "✓ Automação pronta"

# 4. Instalar PM2 globalmente
echo ""
echo "🔄 Configurando auto-restart..."
npm install -g pm2 --silent 2>/dev/null
echo "✓ PM2 OK"

# 5. Criar ecosystem config
cat > /root/dashboardvivera/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'dashboard',
    script: 'server.js',
    cwd: '/root/dashboardvivera',
    instances: 1,
    env: { NODE_ENV: 'production', PORT: 3000 },
    autorestart: true,
    watch: false,
    error_file: './logs/error.log',
    out_file: './logs/out.log'
  }]
};
EOF

# 6. Iniciar com PM2
echo ""
echo "🚀 Iniciando servidor..."
cd /root/dashboardvivera
pm2 start ecosystem.config.js
pm2 save
echo "✓ Servidor iniciado"

# 7. Health check cron
echo ""
echo "📅 Configurando health check (roda a cada 5 min)..."
(crontab -l 2>/dev/null | grep -v "check-dashboard"; echo "*/5 * * * * curl -s http://localhost:3000/api/health > /dev/null 2>&1 || (cd /root/dashboardvivera && pm2 restart dashboard > /dev/null 2>&1)") | crontab -
echo "✓ Health check ativo"

# 8. Aguardar inicialização
echo ""
echo "⏳ Esperando servidor iniciar..."
for i in {1..15}; do
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✓ Servidor respondendo!"
    break
  fi
  sleep 1
done

# 9. Mostrar status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ PRONTO! Dashboard rodando 24/7!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Abra no navegador:"
echo "   http://seu-vps-ip:3000/dashboard/whatsapp"
echo ""
echo "🏥 Status:"
pm2 status
echo ""
echo "📝 Ver logs:"
echo "   pm2 logs"
echo ""
echo "🔄 Reiniciar:"
echo "   pm2 restart dashboard"
echo ""
echo "⚡ O servidor vai:"
echo "   ✅ Auto-reiniciar se cair"
echo "   ✅ Rodar 24/7 sem intervenção"
echo "   ✅ Health check a cada 5 min"
echo "   ✅ Auto-atualizar dados a cada 30s"
echo "   ✅ Sincronizar com N8N automaticamente"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
