#!/bin/bash

# 🤖 Hook de inicialização automática do Claude Code
# Executado quando a sessão inicia

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Inicializando Dashboard de WhatsApp Analytics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado"
    exit 1
fi

echo "✅ Node.js OK ($(node --version))"

# 2. Verificar/instalar dependências
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install > /dev/null 2>&1
    echo "✅ Dependências instaladas"
else
    echo "✅ Dependências OK"
fi

# 3. Rodar setup de automação
echo ""
echo "⚙️  Configurando automação..."
npm run setup > /dev/null 2>&1
echo "✅ Automação configurada"

# 4. Verificar .env
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo ""
        echo "⚠️  Arquivo .env não encontrado"
        echo "💡 Criando .env a partir de .env.example..."
        cp .env.example .env
        echo "   → Atualize os valores em .env com suas credenciais"
    fi
fi

# 5. Criar diretórios
mkdir -p data/{cache,reports}
mkdir -p logs
mkdir -p public/{css,js}
mkdir -p views
mkdir -p src

echo "✅ Diretórios criados"

# 6. Status final
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Dashboard pronto!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Para iniciar o servidor:"
echo "   npm start"
echo ""
echo "🔗 Acessar em:"
echo "   http://localhost:3000/dashboard/whatsapp"
echo ""
