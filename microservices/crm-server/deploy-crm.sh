#!/bin/bash
# ============================================================
# DEPLOY DO VIVERA CRM NA VPS
# Roda NA VPS (como root ou usuário com sudo), a partir da pasta
# do repositório dashboardvivera já atualizado.
#
#   cd /home/user/dashboardvivera/microservices/crm-server
#   bash deploy-crm.sh
#
# Idempotente: pode rodar de novo sem quebrar nada.
# ============================================================
set -e

CRM_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$CRM_DIR"
echo "== Deploy do Vivera CRM a partir de: $CRM_DIR"

# ---------- 1. Dependências ----------
command -v node >/dev/null || { echo "ERRO: node não instalado"; exit 1; }
command -v mysql >/dev/null || { echo "ERRO: mysql client não instalado"; exit 1; }
command -v pm2 >/dev/null || npm install -g pm2

echo "== Instalando dependências do crm-server..."
npm install --omit=dev

# ---------- 2. Banco de dados ----------
# Usa acesso root local do MySQL (socket). Se o root tiver senha, exporte MYSQL_ROOT_PWD antes.
MYSQL_CMD="mysql"
[ -n "$MYSQL_ROOT_PWD" ] && MYSQL_CMD="mysql -uroot -p$MYSQL_ROOT_PWD"

echo "== Criando banco vivera_crm (se não existir)..."
$MYSQL_CMD < sql/schema.sql
$MYSQL_CMD < sql/seed.sql

# usuário de aplicação
CRM_DB_PASSWORD="${CRM_DB_PASSWORD:-$(openssl rand -hex 16)}"
$MYSQL_CMD -e "CREATE USER IF NOT EXISTS 'vivera_crm'@'localhost' IDENTIFIED BY '$CRM_DB_PASSWORD';
GRANT ALL ON vivera_crm.* TO 'vivera_crm'@'localhost'; FLUSH PRIVILEGES;"

# ---------- 3. Arquivo .env ----------
if [ ! -f .env ]; then
  echo "== Gerando .env..."
  cat > .env <<EOF
CRM_DB_HOST=127.0.0.1
CRM_DB_PORT=3306
CRM_DB_USER=vivera_crm
CRM_DB_PASSWORD=$CRM_DB_PASSWORD
CRM_DB_NAME=vivera_crm
CRM_PORT=3005
CRM_JWT_SECRET=$(openssl rand -hex 32)
CRM_ENABLE_CRON=true
CRM_RECONCILE_BUDGET=500

# Preencher quando tiver o token (a varredura das 2h só roda com ele):
PIPEDRIVE_TOKEN=
PIPEDRIVE_COMPANY_DOMAIN=viveraorofacialavanada

# Segredo do webhook do Tintim (configurar o mesmo valor no painel do Tintim):
TINTIM_WEBHOOK_SECRET=$(openssl rand -hex 16)
EOF
  echo "   .env criado. IMPORTANTE: adicionar o PIPEDRIVE_TOKEN depois."
else
  echo "   .env já existe, mantendo."
fi

# ---------- 4. Usuários do CRM ----------
echo "== Criando usuários do CRM (senhas temporárias — trocar depois)..."
node scripts/create-user.js "Diego" diegoandreiaguiar@gmail.com "${DIEGO_PWD:-vivera2026}" admin
node scripts/create-user.js "Helenice" helenice@vivera.com "${SDR_PWD:-vivera2026}" sdr
node scripts/create-user.js "Agda" agda@vivera.com "${SDR_PWD:-vivera2026}" sdr

# ---------- 5. Importação dos exports (se os CSVs estiverem na pasta data-import/) ----------
if [ -f data-import/deals.csv ]; then
  echo "== Importando negócios do Pipedrive..."
  node scripts/import-real-export.js data-import/deals.csv
fi
if [ -f data-import/people.csv ]; then
  echo "== Enriquecendo pacientes com telefones..."
  node scripts/enrich-people-export.js data-import/people.csv
fi

# ---------- 6. PM2 ----------
echo "== Subindo crm-server no PM2..."
pm2 delete vivera-crm 2>/dev/null || true
pm2 start server.js --name vivera-crm
pm2 save

# ---------- 7. Frontend ----------
echo "== Build do frontend (web/)..."
cd "$CRM_DIR/../.."
if [ -d web ]; then
  cd web && npm install && npm run build
  echo "   web/dist atualizado. O servidor que serve o site deve apontar para web/dist."
fi

echo ""
echo "============================================================"
echo "DEPLOY CONCLUÍDO."
echo ""
echo "Passos finais manuais:"
echo "1. Proxy do site para a API do CRM: quem serve dashboard.viveraorofacial.com"
echo "   precisa encaminhar /api/crm/* para http://127.0.0.1:3005"
echo "   Exemplo nginx:"
echo "     location /api/crm/ { proxy_pass http://127.0.0.1:3005/api/crm/; }"
echo "2. PIPEDRIVE_TOKEN no .env (varredura das 2h) e depois: pm2 restart vivera-crm"
echo "3. Webhook do Tintim apontando para:"
echo "   https://SEU-DOMINIO/api/crm/webhooks/tintim?secret=(valor de TINTIM_WEBHOOK_SECRET no .env)"
echo "4. Login inicial: diegoandreiaguiar@gmail.com / vivera2026 (trocar a senha)"
echo "============================================================"
