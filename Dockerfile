FROM node:18-alpine

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache curl

# Copiar package.json
COPY package*.json /app/

# Instalar dependências
RUN npm ci --only=production

# Copiar o código
COPY server.js /app/
COPY dashboard*.html /app/
COPY debug-pipedrive.js /app/
COPY web/dist /app/web/dist

# Criar diretórios necessários
RUN mkdir -p /app/data /app/logs

# Expor porta
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Iniciar aplicação
CMD ["node", "server.js"]
