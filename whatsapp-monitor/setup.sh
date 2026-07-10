#!/usr/bin/env bash
# Preenche os campos que ainda faltam no whatsapp-monitor/.env (SESSION_SECRET,
# senhas dos SDRs, N8N_WEBHOOK, PIPEDRIVE_TOKEN reaproveitado da raiz do repo)
# sem mexer em nada que ja esteja preenchido (ex: DB_* que outra sessao ja configurou).
#
# Uso: bash whatsapp-monitor/setup.sh
set -euo pipefail
cd "$(dirname "$0")"

WM_ENV=".env"
ROOT_ENV="../.env"
N8N_WEBHOOK_VALUE="https://n8n.srv1522176.hstgr.cloud/webhook/whatsapp-script-analysis"

touch "$WM_ENV"

# preenche KEY= (vazio) ou adiciona KEY=valor se a linha nem existir; nunca sobrescreve valor ja preenchido
set_if_blank() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$WM_ENV"; then
    local current
    current=$(grep "^${key}=" "$WM_ENV" | head -1 | cut -d= -f2-)
    if [ -z "$current" ]; then
      local tmp
      tmp=$(mktemp)
      awk -v k="$key" -v v="$value" -F= 'BEGIN{OFS="="} $1==k && $2=="" {$0=k"="v} {print}' "$WM_ENV" > "$tmp"
      mv "$tmp" "$WM_ENV"
      echo "Preenchido $key"
    fi
  else
    echo "${key}=${value}" >> "$WM_ENV"
    echo "Adicionado $key"
  fi
}

set_if_blank PORT 4001
set_if_blank DB_PORT 3306
set_if_blank SESSION_SECRET "$(openssl rand -hex 32)"
set_if_blank SDR_PASSWORD_HELENICE "$(openssl rand -hex 6)"
set_if_blank SDR_PASSWORD_AGDA "$(openssl rand -hex 6)"
set_if_blank N8N_WEBHOOK "$N8N_WEBHOOK_VALUE"

# reaproveita o PIPEDRIVE_TOKEN da raiz do repo, so se ainda estiver vazio aqui
if [ -f "$ROOT_ENV" ]; then
  ROOT_TOKEN=$(grep -m1 '^PIPEDRIVE_TOKEN=' "$ROOT_ENV" | cut -d= -f2- || true)
  [ -n "$ROOT_TOKEN" ] && set_if_blank PIPEDRIVE_TOKEN "$ROOT_TOKEN"
fi

chmod 600 "$WM_ENV"

echo
echo "Conteudo atual de $WM_ENV (valores mascarados, so pra conferir o que ficou vazio):"
sed -E 's/^([A-Z_]+)=(.+)$/\1=***/; s/^([A-Z_]+)=$/\1=(vazio!)/' "$WM_ENV"

# valida se o host do banco configurado e alcancavel - o erro mais comum aqui e
# usar o nome do container Docker (ex: vivera-mysql) enquanto a app roda direto
# no host via "npm start": nesse caso o nome do container so resolve de DENTRO
# da rede Docker, e o DB_HOST certo pra rodar fora do Docker e 127.0.0.1
DB_HOST_VALUE=$(grep -m1 '^DB_HOST=' "$WM_ENV" | cut -d= -f2- || true)
DB_PORT_VALUE=$(grep -m1 '^DB_PORT=' "$WM_ENV" | cut -d= -f2- || echo 3306)
if [ -n "$DB_HOST_VALUE" ] && command -v node >/dev/null 2>&1; then
  if ! node -e "
const net = require('net');
const s = net.createConnection({ host: process.argv[1], port: Number(process.argv[2]), timeout: 3000 });
s.on('connect', () => { s.destroy(); process.exit(0); });
s.on('error', () => process.exit(1));
s.on('timeout', () => process.exit(1));
" "$DB_HOST_VALUE" "$DB_PORT_VALUE"; then
    echo
    echo "ATENCAO: nao consegui abrir conexao TCP com DB_HOST=$DB_HOST_VALUE:$DB_PORT_VALUE a partir daqui."
    echo "Se voce vai rodar com 'npm start' direto no host (fora de Docker), troque"
    echo "DB_HOST=$DB_HOST_VALUE por DB_HOST=127.0.0.1 no $WM_ENV (o nome do container"
    echo "so resolve de dentro da rede Docker)."
  else
    echo
    echo "Conexao TCP com DB_HOST=$DB_HOST_VALUE:$DB_PORT_VALUE OK."
  fi
fi

echo
echo "Falta so voce rodar a aplicacao:"
echo "  cd $(pwd) && npm install && npm start"
echo "(ou, se preferir manter rodando apos fechar o terminal: npx pm2 start server.js --name whatsapp-monitor)"
