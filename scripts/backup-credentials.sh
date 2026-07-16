#!/bin/bash
# Script de backup seguro de credenciais
# USO: ./scripts/backup-credentials.sh [diretório-destino]
# Exemplo: ./scripts/backup-credentials.sh ~/credenciais-backup

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Diretório de destino (padrão: ~/vivera-credentials-backup)
BACKUP_DIR="${1:-${HOME}/vivera-credentials-backup}"

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}🔐 Iniciando backup de credenciais...${NC}"
echo "Projeto: $PROJECT_DIR"
echo "Backup para: $BACKUP_DIR"
echo ""

# Arquivos a fazer backup
FILES_TO_BACKUP=(
  ".env"
  "config/settings.json"
)

# Timestamp para backup versionado
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="vivera-credentials-$TIMESTAMP"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

# Criar diretório versionado
mkdir -p "$BACKUP_PATH"

# Fazer backup de cada arquivo
echo "📁 Copiando credenciais..."
for file in "${FILES_TO_BACKUP[@]}"; do
  if [ -f "$PROJECT_DIR/$file" ]; then
    echo "  ✅ $file"
    cp "$PROJECT_DIR/$file" "$BACKUP_PATH/"
  else
    echo "  ⚠️  $file (não encontrado)"
  fi
done

# Criar arquivo de info
cat > "$BACKUP_PATH/INFO.txt" << EOF
==============================================
VIVERA COMMAND CENTER - BACKUP DE CREDENCIAIS
==============================================

Data/Hora: $(date '+%Y-%m-%d %H:%M:%S')
Projeto: $PROJECT_DIR
Host: $(hostname)
Usuário: $(whoami)

ARQUIVOS INCLUSOS:
- .env (variáveis de ambiente)
- config/settings.json (configurações via SaaS)

INSTRUÇÕES DE RESTAURAÇÃO:
1. Copie os arquivos deste backup para o projeto
2. Reinicie o servidor: pm2 restart dashboardvivera
3. Acesse: http://seu-ip:3000/configuracoes
4. Clique em "Testar Conexões" para validar

AVISOS DE SEGURANÇA:
⚠️  NUNCA commite .env ou config/settings.json no git
⚠️  NUNCA compartilhe este backup por email/Slack desprotegido
⚠️  PROTEJA ESTE DIRETÓRIO COM PERMISSÕES RESTRITAS
⚠️  CONSIDERE CRIPTOGRAFAR ESTE BACKUP

RESTAURAR PERMISSÕES (se necessário):
  chmod 600 $BACKUP_PATH/.env
  chmod 600 $BACKUP_PATH/config/settings.json

==============================================
EOF

# Definir permissões restritivas
chmod 600 "$BACKUP_PATH/.env" 2>/dev/null || true
chmod 600 "$BACKUP_PATH/config/settings.json" 2>/dev/null || true
chmod 700 "$BACKUP_PATH"

echo ""
echo -e "${GREEN}✅ Backup concluído!${NC}"
echo ""
echo "📍 Local: $BACKUP_PATH"
echo "📦 Arquivos: $(ls -1 "$BACKUP_PATH" | wc -l)"
echo ""
echo -e "${YELLOW}⚠️  LEMBRE-SE:${NC}"
echo "  1. Proteja este diretório com permissões restritas"
echo "  2. Considere fazer backup em um local externo"
echo "  3. Criptografe o backup se armazenar remotamente"
echo "  4. Teste a restauração periodicamente"
echo ""
echo "📋 Listar backups anteriores:"
echo "  ls -1 $BACKUP_DIR"
echo ""
echo -e "${GREEN}Backup de credenciais protegido ✓${NC}"
