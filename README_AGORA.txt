╔════════════════════════════════════════════════════════════════╗
║         DASHBOARD VIVERA - PRONTO PARA DEPLOY                 ║
╚════════════════════════════════════════════════════════════════╝

✅ CÓDIGO COMPLETO E TESTADO

Última versão: a9ba7f1 (11/07/2026)
Branch: claude/meta-pipe-api-integration-luq1ht

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 MUDANÇAS IMPLEMENTADAS:

✓ Conjunto (público-alvo) ao lado do criativo
✓ Tags e motivos de perda como badges inline
✓ KPIs com closing time em dias
✓ Leads by channel (Instagram vs Google)
✓ Dashboard index com links
✓ PM2 auto-restart
✓ Webhook de deploy automático
✓ Instruções de recuperação

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 PARA ATIVAR AGORA NA VPS:

1. Entre na VPS via SSH
2. Cole este comando inteiro:

cd /root/dashboardvivera && \
git reset --hard HEAD && \
git checkout claude/meta-pipe-api-integration-luq1ht && \
git reset --hard origin/claude/meta-pipe-api-integration-luq1ht && \
npm install --silent && \
pkill -9 node 2>/dev/null || true && \
pm2 kill 2>/dev/null || true && \
sleep 3 && \
npm install -g pm2 --silent 2>/dev/null || true && \
pm2 start ecosystem.config.js && \
pm2 status

3. Acesse: http://seu-vps-ip:3000

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 ARQUIVOS IMPORTANTES:

FIX_AGORA.md           → Instruções detalhadas de emergência
quick-fix.sh           → Script rápido de recuperação
deploy-via-webhook.sh  → Deploy via HTTP
index.html             → Página inicial com links

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 PRÓXIMAS VEZES (AUTOMÁTICO):

1. Faz push na branch
2. GitHub Actions faz deploy automático
3. PM2 reinicia servidor
4. Sem precisar fazer nada!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ PRONTO! Tudo está preparado e esperando apenas ser ativado.

