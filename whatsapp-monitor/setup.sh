#!/usr/bin/env bash
# Automatiza o setup do whatsapp-monitor: gera todos os segredos, escreve o .env,
# sobe o banco (MariaDB em container, schema aplicado automaticamente) e o app,
# e tenta mapear Helenice/Agda pros IDs de usuario delas no Pipedrive.
#
# Uso: bash whatsapp-monitor/setup.sh   (a partir da raiz do repo, ou de dentro de whatsapp-monitor/)
set -euo pipefail
cd "$(dirname "$0")"

ROOT_ENV="../.env"
WM_ENV=".env"
N8N_WEBHOOK_VALUE="https://n8n.srv1522176.hstgr.cloud/webhook/whatsapp-script-analysis"

echo "== whatsapp-monitor: setup automatico =="

if [ -f "$WM_ENV" ]; then
  echo "$WM_ENV ja existe - nao vou sobrescrever pra nao perder segredos ja gerados."
  echo "Apague $(pwd)/$WM_ENV manualmente se quiser gerar tudo de novo."
  exit 1
fi

# reaproveita o token do Pipedrive que o resto do projeto ja usa, se existir
PIPEDRIVE_TOKEN_VALUE=""
if [ -f "$ROOT_ENV" ]; then
  PIPEDRIVE_TOKEN_VALUE=$(grep -m1 '^PIPEDRIVE_TOKEN=' "$ROOT_ENV" | cut -d= -f2- || true)
fi

SESSION_SECRET_VALUE=$(openssl rand -hex 32)
DB_PASSWORD_VALUE=$(openssl rand -hex 20)
SDR_PASSWORD_HELENICE_VALUE=$(openssl rand -hex 6)
SDR_PASSWORD_AGDA_VALUE=$(openssl rand -hex 6)

cat > "$WM_ENV" <<EOF
PORT=4001

DB_HOST=whatsapp-db
DB_USER=whatsapp_monitor
DB_PASSWORD=$DB_PASSWORD_VALUE
DB_NAME=vivera_whatsapp

PIPEDRIVE_TOKEN=$PIPEDRIVE_TOKEN_VALUE

N8N_WEBHOOK=$N8N_WEBHOOK_VALUE

SESSION_SECRET=$SESSION_SECRET_VALUE

SDR_PASSWORD_HELENICE=$SDR_PASSWORD_HELENICE_VALUE
SDR_PASSWORD_AGDA=$SDR_PASSWORD_AGDA_VALUE
EOF
chmod 600 "$WM_ENV"
echo "Gerado $(pwd)/$WM_ENV"

# docker-compose.yml (raiz do repo) le WHATSAPP_DB_PASSWORD do .env da raiz pra injetar no container do banco
if [ ! -f "$ROOT_ENV" ] || ! grep -q '^WHATSAPP_DB_PASSWORD=' "$ROOT_ENV"; then
  echo "WHATSAPP_DB_PASSWORD=$DB_PASSWORD_VALUE" >> "$ROOT_ENV"
  echo "Adicionada WHATSAPP_DB_PASSWORD em $ROOT_ENV"
fi

if [ -z "$PIPEDRIVE_TOKEN_VALUE" ]; then
  echo "ATENCAO: nao achei PIPEDRIVE_TOKEN em $ROOT_ENV - a sincronizacao com o Pipedrive vai ficar inativa ate voce preencher isso em $WM_ENV"
fi

echo
echo "Subindo whatsapp-db e whatsapp-monitor..."
cd ..
docker compose up -d --build whatsapp-db whatsapp-monitor

echo "Aguardando o banco ficar pronto..."
DB_READY=""
for i in $(seq 1 30); do
  if docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD_VALUE" whatsapp-db \
      mysqladmin ping -u whatsapp_monitor --silent >/dev/null 2>&1; then
    DB_READY=1
    break
  fi
  sleep 2
done
[ -n "$DB_READY" ] && echo "Banco pronto." || echo "Banco demorou mais que o esperado - confira 'docker compose logs whatsapp-db' se algo falhar."

if [ -n "$PIPEDRIVE_TOKEN_VALUE" ] && command -v python3 >/dev/null 2>&1; then
  echo
  echo "Tentando mapear automaticamente Helenice/Agda pros usuarios do Pipedrive..."
  USERS_JSON=$(curl -sS "https://api.pipedrive.com/v1/users?api_token=$PIPEDRIVE_TOKEN_VALUE" || true)
  for pair in "helenice:Helenice" "agda:Agda"; do
    key="${pair%%:*}"
    label="${pair##*:}"
    user_id=$(echo "$USERS_JSON" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for u in (data.get('data') or []):
        if '$key' in (u.get('name') or '').lower():
            print(u['id'])
            break
except Exception:
    pass
" 2>/dev/null || true)
    if [ -n "$user_id" ]; then
      docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD_VALUE" whatsapp-db \
        mysql -u whatsapp_monitor vivera_whatsapp -e \
        "INSERT IGNORE INTO pipedrive_users_mapping (pipedrive_user_id, pipedrive_user_name, sdr_name) VALUES ('$user_id', '$label', '$key');"
      echo "  $label -> usuario Pipedrive $user_id (mapeado)"
    else
      echo "  Nao achei usuario do Pipedrive com nome parecido com '$label' - mapeie manualmente na tabela pipedrive_users_mapping."
    fi
  done
else
  echo "Pulando mapeamento automatico do Pipedrive (falta PIPEDRIVE_TOKEN ou python3) - preencher pipedrive_users_mapping manualmente."
fi

SERVER_IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || echo "SEU_IP")

echo
echo "=================================================="
echo "PRONTO."
echo "Painel: http://$SERVER_IP:4001/login"
echo "Login Helenice -> senha: $SDR_PASSWORD_HELENICE_VALUE"
echo "Login Agda     -> senha: $SDR_PASSWORD_AGDA_VALUE"
echo "(essas senhas tambem estao salvas em whatsapp-monitor/.env)"
echo
echo "Unico passo manual que sobra: abrir o painel, entrar em cada sessao"
echo "e escanear o QR code com o WhatsApp de cada numero (isso nao da pra automatizar)."
echo "=================================================="
