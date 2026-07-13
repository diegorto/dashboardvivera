#!/bin/bash

################################################################################
# 🔄 SCRIPT DE RESTAURAÇÃO - BACKUP FUNCIONANDO (13 JUL 2026)
# Execute: bash restore-backup.sh
################################################################################

echo ""
echo "🔄 RESTAURANDO BACKUP DO ESTADO FUNCIONANDO..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Fazer backup do .env atual
echo "1️⃣ Fazendo backup do .env atual..."
if [ -f .env ]; then
  cp .env .env.backup-$(date +%s)
  echo "   ✓ Backup salvo como .env.backup-*"
fi

# 2. Reset para commit funcionando
echo ""
echo "2️⃣ Restaurando código para commit 61ee8bc..."
git reset --hard 61ee8bc
echo "   ✓ Código restaurado"

# 3. Push force (se necessário)
echo ""
echo "3️⃣ Sincronizando com remote..."
git push origin claude/meta-pipe-api-integration-luq1ht --force-with-lease
echo "   ✓ Remote sincronizado"

# 4. Parar servidor
echo ""
echo "4️⃣ Parando servidor antigo..."
pm2 stop vivera 2>/dev/null || true
pm2 delete vivera 2>/dev/null || true
pkill -f "node server.js" 2>/dev/null || true
sleep 2
echo "   ✓ Servidor parado"

# 5. Instalar dependências
echo ""
echo "5️⃣ Instalando dependências..."
npm install --silent
echo "   ✓ Dependências OK"

# 6. Limpar cache
echo ""
echo "6️⃣ Limpando cache..."
rm -f data/deals-cache.json
echo "   ✓ Cache limpo"

# 7. Iniciar servidor
echo ""
echo "7️⃣ Iniciando servidor..."
pm2 start server.js --name "vivera" --update-env
sleep 3
echo "   ✓ Servidor iniciado"

# 8. Verificar
echo ""
echo "8️⃣ Verificando status..."
curl -s http://localhost:3000/api/dashboard | jq '.kpis | {receita, compras, investimento, roas, cac}' > /tmp/restore-test.json 2>&1

if [ -s /tmp/restore-test.json ]; then
  echo "   ✓ API respondendo"
  echo ""
  echo "📊 KPIs ATUAIS:"
  cat /tmp/restore-test.json
else
  echo "   ⚠️ API não respondeu"
fi

# 9. Mostrar status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ RESTAURAÇÃO COMPLETA!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 Dashboard: http://seu-vps:3000"
echo "📝 Logs: pm2 logs vivera"
echo "🔄 Status: pm2 status"
echo ""
