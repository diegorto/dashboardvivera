#!/bin/bash
set -euo pipefail
export NODE_PATH="/root/dashboardvivera-prod/microservices/crm-server/node_modules"
echo "[$(date '+%F %T')] Iniciando export-sheets.js"
node /root/dashboardvivera-prod/scripts/export-sheets.js
echo "[$(date '+%F %T')] export-sheets.js finalizado com sucesso"
