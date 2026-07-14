# ============================================
# STAGE 1: BUILD FRONTEND
# ============================================
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copiar package.json da web
COPY web/package*.json /app/web/

WORKDIR /app/web

# Instalar dependências e build
RUN npm ci && npm run build

# ============================================
# STAGE 2: RUNTIME
# ============================================
FROM node:18-alpine

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache curl dumb-init

# Copiar package.json da aplicação principal
COPY package*.json /app/

# Instalar dependências
RUN npm ci --only=production

# Copiar o código da aplicação
COPY server.js /app/
COPY dashboard*.html /app/
COPY debug-pipedrive.js /app/

# Copiar frontend buildado do stage anterior
COPY --from=frontend-builder /app/web/dist /app/web/dist

# Criar diretórios necessários
RUN mkdir -p /app/data /app/logs

# Expor porta
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Usar dumb-init para melhor gerenciamento de processos
ENTRYPOINT ["/sbin/dumb-init", "--"]

# Iniciar aplicação
CMD ["node", "server.js"]
