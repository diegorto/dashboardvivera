#!/bin/bash
# Script de restauração de credenciais do backup
# USO: ./scripts/restore-credentials.sh [caminho-do-backup]
# Exemplo: ./scripts/restore-credentials.sh ~/vivera-credentials-backup/vivera-credentials-20260716_150000

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Diretório de backup
BACKUP_DIR="${1}"

# Validações
if [ -z "$BACKUP_DIR" ]; then
  echo -e "${RED}❌ Erro: Caminho do backup não fornecido${NC}"
  echo ""
  echo "USO: ./scripts/restore-credentials.sh [caminho-do-backup]"
  echo ""
  echo "Backups disponíveis:"
  ls -1d ~/vivera-credentials-backup/vivera-credentials-* 2>/dev/null || echo "  Nenhum backup encontrado em ~/vivera-credentials-backup"
  exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo -e "${RED}❌ Erro: Diretório não encontrado: $BACKUP_DIR${NC}"
  exit 1
fi

if [ ! -f "$BACKUP_DIR/.env" ]; then
  echo -e "${RED}❌ Erro: Arquivo .env não encontrado no backup${NC}"
  exit 1
fi

echo -e "${YELLOW}🔐 Restaurando credenciais...${NC}"
echo "Backup: $BACKUP_DIR"
echo "Projeto: $PROJECT_DIR"
echo ""

# Avisar usuário
echo -e "${RED}⚠️  AVISO - OPERAÇÃO DESTRUTIVA${NC}"
echo "Esta operação substituirá as credenciais atuais!"
echo ""
read -p "Tem certeza que deseja continuar? (s/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
  echo -e "${YELLOW}Operação cancelada.${NC}"
  exit 0
fi

# Fazer backup das credenciais atuais primeiro (backup de backup!)
echo ""
echo "💾 Fazendo backup das credenciais atuais antes de restaurar..."

EMERGENCY_BACKUP="$PROJECT_DIR/.env.backup.$(date +%s)"

if [ -f "$PROJECT_DIR/.env" ]; then
  cp "$PROJECT_DIR/.env" "$EMERGENCY_BACKUP"
  chmod 600 "$EMERGENCY_BACKUP"
  echo -e "${GREEN}  ✅ Backup de emergência: $EMERGENCY_BACKUP${NC}"
fi

# Restaurar arquivo por arquivo
echo ""
echo "📁 Restaurando arquivos..."

# Restaurar .env
echo "  Restaurando .env..."
cp "$BACKUP_DIR/.env" "$PROJECT_DIR/.env"
chmod 600 "$PROJECT_DIR/.env"
echo -e "  ${GREEN}✅ .env restaurado${NC}"

# Restaurar config/settings.json se existir
if [ -f "$BACKUP_DIR/config/settings.json" ]; then
  mkdir -p "$PROJECT_DIR/config"
  cp "$BACKUP_DIR/config/settings.json" "$PROJECT_DIR/config/settings.json"
  chmod 600 "$PROJECT_DIR/config/settings.json"
  echo -e "  ${GREEN}✅ config/settings.json restaurado${NC}"
fi

echo ""
echo -e "${GREEN}✅ Credenciais restauradas com sucesso!${NC}"
echo ""
echo "📋 Próximos passos:"
echo "  1. Reinicie o servidor: pm2 restart dashboardvivera"
echo "  2. Aguarde 10 segundos"
echo "  3. Acesse: http://seu-ip:3000/configuracoes"
echo "  4. Clique em 'Testar Conexões' para validar"
echo ""
echo "🆘 Se algo der errado:"
echo "  Restaure o backup de emergência:"
echo "  cp $EMERGENCY_BACKUP $PROJECT_DIR/.env"
echo ""

# Perguntar se quer reiniciar agora
read -p "Deseja reiniciar o servidor agora? (s/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
  echo -e "${BLUE}Reiniciando servidor...${NC}"
  cd "$PROJECT_DIR"
  pm2 restart dashboardvivera
  echo -e "${GREEN}✅ Servidor reiniciado${NC}"
  echo ""
  echo "Verificar status: pm2 status"
  echo "Ver logs: pm2 logs dashboardvivera"
fi
