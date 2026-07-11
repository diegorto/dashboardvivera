# 🚨 INSTRUÇÕES PARA SINCRONIZAR AGORA

## Copie E COLE isso no terminal da VPS:

```bash
cd /root/dashboardvivera && \
git status && \
git log --oneline -5 && \
git fetch origin && \
git reset --hard HEAD && \
git checkout claude/meta-pipe-api-integration-luq1ht && \
git reset --hard origin/claude/meta-pipe-api-integration-luq1ht && \
npm install --silent && \
pkill -9 node 2>/dev/null || true && \
pm2 kill 2>/dev/null || true && \
sleep 3 && \
npm install -g pm2 --silent 2>/dev/null || true && \
cat > ecosystem.config.js << 'EOPM2'
module.exports = {
  apps: [{
    name: 'dashboard',
    script: 'server.js',
    env: { PORT: 3000, NODE_ENV: 'production' },
    autorestart: true,
    watch: false
  }]
};
EOPM2
pm2 start ecosystem.config.js && \
pm2 status && \
sleep 3 && \
curl -s http://localhost:3000 | head -30
```

## O que isso faz:
1. ✅ Verifica status atual
2. ✅ Força reset para o código mais recente
3. ✅ Instala dependências limpas
4. ✅ Mata todos os processos Node
5. ✅ Reinicia com PM2
6. ✅ Testa se está respondendo

## Depois de rodar:
- Acesse: http://seu-vps-ip:3000
- Você verá a página com links para os dashboards
- Clique em "SDR Dashboard" para ver o painel

---

## ⚠️ Se ainda não funcionar:

### Opção 1 - Limpar completamente:
```bash
cd /root/dashboardvivera && \
pm2 stop all && pm2 delete all && \
rm -rf node_modules package-lock.json && \
git clean -fd && \
git checkout . && \
git pull origin claude/meta-pipe-api-integration-luq1ht && \
npm install && \
pm2 start server.js --name dashboard
```

### Opção 2 - Ver o que tá acontecendo:
```bash
pm2 logs dashboard
pm2 status
ps aux | grep node
lsof -i :3000
```

### Opção 3 - Forçar porta 3000:
```bash
fuser -k 3000/tcp 2>/dev/null || true
pkill -9 node
sleep 2
pm2 restart dashboard
```

---

**Código MAIS RECENTE está no GitHub:**
https://github.com/diegorto/dashboardvivera/tree/claude/meta-pipe-api-integration-luq1ht

**Últimos commits:**
- ✅ Index page com links para dashboards
- ✅ Webhook para auto-deploy
- ✅ PM2 ecosystem config
- ✅ Conjunto exibido ao lado dos criativos
- ✅ KPIs e métricas

Tudo pronto - apenas execute o comando acima!
