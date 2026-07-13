#!/bin/bash

echo "🔧 Configuração do Vivera Dashboard"
echo "===================================="
echo ""

# Verificar se .env já existe
if [ -f .env ]; then
  echo "⚠️  .env já existe. Deseja sobrescrever? (s/n)"
  read -r response
  if [ "$response" != "s" ]; then
    echo "Abortado."
    exit 0
  fi
fi

echo ""
echo "📝 Preencha as credenciais abaixo:"
echo ""

# Pipedrive
echo "1️⃣  PIPEDRIVE_TOKEN"
echo "   Obter em: https://app.pipedrive.com/settings/personal"
read -p "   Token: " PIPEDRIVE_TOKEN

# Facebook
echo ""
echo "2️⃣  FB_ACCESS_TOKEN (Meta Ads)"
echo "   Obter em: https://developers.facebook.com/tools/explorer/"
echo "   ⚠️  Use um token de longa duração (dura ~60 dias)"
read -p "   Token: " FB_ACCESS_TOKEN

# Tintim
echo ""
echo "3️⃣  TINTIM_ACCOUNT_CODE"
read -p "   Account Code: " TINTIM_ACCOUNT_CODE

echo ""
echo "4️⃣  TINTIM_ACCOUNT_TOKEN"
read -p "   Token: " TINTIM_ACCOUNT_TOKEN

# Criar .env
cat > .env << ENVEOF
PIPEDRIVE_TOKEN=$PIPEDRIVE_TOKEN
FB_ACCESS_TOKEN=$FB_ACCESS_TOKEN
FB_AD_ACCOUNT_IDS=251144237263450,805112190602712,1416785793548920
PORT=3000
TINTIM_ACCOUNT_CODE=$TINTIM_ACCOUNT_CODE
TINTIM_ACCOUNT_TOKEN=$TINTIM_ACCOUNT_TOKEN
WHATSAPP_DB_HOST=127.0.0.1
WHATSAPP_DB_PORT=3306
WHATSAPP_DB_USER=root
WHATSAPP_DB_PASSWORD=
WHATSAPP_DB_NAME=vivera_whatsapp
ENVEOF

echo ""
echo "✅ .env criado com sucesso!"
echo ""
echo "🚀 Para iniciar o servidor:"
echo "   pm2 restart vivera --update-env"
