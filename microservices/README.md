# Arquitetura de Microserviços - Dashboard Vivera

## Estrutura

```
microservices/
├── dashboard-frontend/    (Porta 3000) - Agregador / Frontend
├── meta-server/           (Porta 3001) - Meta Ads API
├── google-server/         (Porta 3002) - Google Ads API
├── tintim-server/         (Porta 3003) - Tintim API
├── pipedrive-server/      (Porta 3004) - Pipedrive API
└── whatsapp-server/       (Porta 3005) - WhatsApp API (futuro)
```

## Setup Inicial

### 1. Meta Server

```bash
cd meta-server
npm install
cp .env.example .env
# Editar .env com credenciais
npm run dev
```

### 2. Google Server

```bash
cd google-server
npm install
cp .env.example .env
# Editar .env com credenciais
npm run dev
```

### 3. Tintim Server

```bash
cd tintim-server
npm install
cp .env.example .env
# Editar .env com credenciais
npm run dev
```

### 4. Pipedrive Server

```bash
cd pipedrive-server
npm install
cp .env.example .env
# Editar .env com credenciais
npm run dev
```

### 5. Pipedrive Server

```bash
cd pipedrive-server
npm install
cp .env.example .env
# Editar .env com credenciais
npm run dev
```

### 6. Dashboard Frontend

```bash
cd dashboard-frontend
npm install
cp .env.example .env
# .env já está configurado com URLs padrão dos serviços
npm run dev
```

### 7. WhatsApp Server (Futuro)

```bash
cd whatsapp-server
npm install
cp .env.example .env
# Editar .env com credenciais
npm run dev
```

---

## Testando os Serviços

### Health Check Geral
```bash
curl http://localhost:3000/api/health
```

### Dados Agregados
```bash
curl "http://localhost:3000/api/dashboard?since=2026-07-01&until=2026-07-13"
```

### Meta Ads
```bash
curl "http://localhost:3001/api/ads?since=2026-07-01&until=2026-07-13"
curl "http://localhost:3001/api/spend?since=2026-07-01&until=2026-07-13"
```

### Google Ads
```bash
curl "http://localhost:3002/api/ads?since=2026-07-01&until=2026-07-13"
curl "http://localhost:3002/api/spend?since=2026-07-01&until=2026-07-13"
```

### Pipedrive
```bash
curl "http://localhost:3004/api/deals?since=2026-07-01&until=2026-07-13"
curl "http://localhost:3004/api/funnel?since=2026-07-01&until=2026-07-13"
curl "http://localhost:3004/api/revenue?since=2026-07-01&until=2026-07-13"
curl "http://localhost:3004/api/leads-sem-origem?since=2026-07-01&until=2026-07-13"
curl "http://localhost:3004/api/outras-fontes?since=2026-07-01&until=2026-07-13"
```

### Tintim
```bash
curl http://localhost:3003/api/audit
```

---

## PM2 Deploy

```bash
# Iniciar todos os serviços
pm2 start meta-server/server.js --name "meta"
pm2 start google-server/server.js --name "google"
pm2 start tintim-server/server.js --name "tintim"
pm2 start pipedrive-server/server.js --name "pipedrive"
pm2 start dashboard-frontend/server.js --name "frontend"

# Salvar config
pm2 save

# Restart todos
pm2 restart all

# Ver logs
pm2 logs

# Monitorar
pm2 monit
```

---

## Vantagens da Arquitetura

✅ **Isolamento**: Atualizar Meta não afeta Google/Tintim/Pipedrive  
✅ **Independência**: Cada serviço tem seu próprio token/credencial  
✅ **Escalabilidade**: Cada serviço pode rodar em máquina diferente  
✅ **Debug fácil**: Testar cada serviço independentemente  
✅ **Cache independente**: Cada serviço gerencia seu próprio cache  
✅ **Falha graciosa**: Se um serviço cai, os outros continuam  

---

## Fluxo de Dados

```
Frontend React
    ↓
Dashboard Frontend (Porta 3000)
    ↓
    ├─→ Meta Server (3001)
    ├─→ Google Server (3002)
    ├─→ Tintim Server (3003)
    ├─→ Pipedrive Server (3004)
    └─→ WhatsApp Server (3005) [Futuro]
```

---

## Arquivos Importantes

- **meta-server/server.js**: Integração com Meta Ads API
- **google-server/server.js**: Integração com Google Ads API (TODO)
- **tintim-server/server.js**: Integração com Tintim API
- **pipedrive-server/server.js**: Integração com Pipedrive API
- **dashboard-frontend/server.js**: Agregador de dados

---

## Próximos Passos

1. Completar integração do Google Server
2. Integrar React frontend com dashboard-frontend
3. Adicionar autenticação entre serviços (se necessário)
4. Configurar SSL/TLS para produção
5. Adicionar circuit breaker para falhas de serviços
