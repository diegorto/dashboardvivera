#!/bin/bash
set -euo pipefail

ENV_FILE="/root/dashboardvivera-prod/microservices/crm-server/.env"
DB_HOST=$(grep -E '^CRM_DB_HOST=' "$ENV_FILE" | cut -d '=' -f2-)
DB_USER=$(grep -E '^CRM_DB_USER=' "$ENV_FILE" | cut -d '=' -f2-)
DB_PASS=$(grep -E '^CRM_DB_PASSWORD=' "$ENV_FILE" | cut -d '=' -f2-)
DB_NAME=$(grep -E '^CRM_DB_NAME=' "$ENV_FILE" | cut -d '=' -f2-)

BACKUP_DIR="/root/backups_diarios"
mkdir -p "$BACKUP_DIR"

DATE=$(date +%F)
OUT_FILE="$BACKUP_DIR/vivera_crm_${DATE}.sql.gz"
TMP_FILE="${OUT_FILE}.tmp"

echo "[$(date '+%F %T')] Iniciando backup de $DB_NAME..."

mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" --single-transaction --routines --triggers --events "$DB_NAME" | gzip > "$TMP_FILE"

if [ ! -s "$TMP_FILE" ]; then
  echo "[$(date '+%F %T')] ERRO: backup vazio ou mysqldump falhou" >&2
  rm -f "$TMP_FILE"
  exit 1
fi

mv "$TMP_FILE" "$OUT_FILE"
echo "[$(date '+%F %T')] Backup criado: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

# Rotacao: manter apenas os ultimos 30 dias
find "$BACKUP_DIR" -name 'vivera_crm_*.sql.gz' -mtime +30 -delete

echo "[$(date '+%F %T')] Backup diario concluido."
