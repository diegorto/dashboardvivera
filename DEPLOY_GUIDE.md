# Guia de Deploy - Dashboard Vivera

## Status Atual
✅ Código commitado e pronto para deploy  
✅ Frontend compilado com novas abas (Google Ads, Meta Ads)  
✅ Backend com sistema de sync de attendance  

## Opções de Deploy

### Opção 1: Docker Compose (Recomendado)

**No seu servidor:**

```bash
cd /caminho/para/dashboardvivera

# 1. Fazer pull do código mais recente
git fetch origin
git checkout claude/reinice-ren84r

# 2. Parar containers antigos
docker compose down

# 3. Rebuild e start
docker compose up -d --build

# 4. Verificar status
docker compose logs -f
```

**O que acontece:**
- Backend é rebuildeado com Dockerfile.backend
- Frontend é rebuildeado com Dockerfile.frontend  
- Ambos são startados em containers separados

### Opção 2: Deploy Manual (Sem Docker)

Se estiver rodando diretamente no servidor:

```bash
cd /caminho/para/dashboardvivera

# 1. Fazer pull do código
git fetch origin
git checkout claude/reinice-ren84r

# 2. Parar servidor antigo
pkill -f "node server.js"

# 3. Instalar dependências (se necessário)
npm install

# 4. Iniciar servidor
NODE_ENV=production node server.js &

# 5. O frontend já está em frontend/dist (compilado)
# O servidor serve automaticamente em /
```

## O Que Foi Atualizado

### Frontend (`frontend/`)
- ✅ Adicionadas abas no Sidebar:
  - Google Ads (🔍)
  - Meta Ads (📱)
- ✅ Build otimizado (size < 180KB gzipped)

### Backend (`server.js`)
- ✅ Sistema de sync de attendance com 6 endpoints:
  - `POST /api/attendance/sync` - Registrar attendance individual
  - `POST /api/attendance/sync-bulk` - Registrar múltiplos
  - `GET /api/attendance/diagnostic` - Ver status atual
  - `GET /api/attendance/pending` - Listar o que falta
  - `GET /api/attendance/sdr-verification` - Verificar dados de SDR
  - `GET /api/attendance/sync-today` - Status de hoje

## Verificação Pós-Deploy

Depois que fizer deploy, verifique que tudo está funcionando:

### 1. Abas no Sidebar
- Abra http://seu-servidor:8000
- Verify que Google Ads e Meta Ads aparecem no menu lateral esquerdo

### 2. Google Ads Dashboard
- Clique em "Google Ads"
- Deve mostrar KPIs: Investimento, Faturamento, ROAS, ROI, Leads, CPL

### 3. Meta Ads Dashboard  
- Clique em "Meta Ads"
- Mesmo layout que Google Ads mas com dados do Meta

### 4. Sistema de Attendance (DEBUG)
- Chame: `GET http://seu-servidor:8000/api/attendance/diagnostic`
- Deve mostrar coverage rate de attendance para hoje

### 5. Verificação de SDR
- Chame: `GET http://seu-servidor:8000/api/attendance/sdr-verification`
- Deve mostrar dados de Agda e Helenice

## Sync de Attendance Faltando

Se você tem agendamentos sem attendance registrados (Agda/Helenice):

### Passo 1: Ver o que falta
```bash
curl http://seu-servidor:8000/api/attendance/pending
```

### Passo 2: Registrar attendance
```bash
curl -X POST http://seu-servidor:8000/api/attendance/sync-bulk \
  -H "Content-Type: application/json" \
  -d '{
    "appointments": [
      {
        "dealId": 789,
        "personId": 456,
        "userId": 123,
        "dueDate": "2026-07-16",
        "dueTime": "10:00",
        "status": "attended"
      }
    ]
  }'
```

## Logs

Para verificar o que está acontecendo:

### Com Docker Compose
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

### Sem Docker
```bash
# Ver logs do Node
tail -f /tmp/dashboardvivera.log

# Ou se estiver rodando em foreground, já vê os logs
```

## Rollback (Se Necessário)

Se algo der errado, volte para a versão anterior:

```bash
git checkout main  # ou a branch anterior
docker compose down
docker compose up -d --build
```

## Documentação

Leia os seguintes arquivos para mais detalhes:

- `ATTENDANCE_INVESTIGATION_SUMMARY.md` - Investigação completa do problema de attendance
- `docs/ATTENDANCE_SYNC_GUIDE.md` - Guia técnico do sistema de sync
- `Dockerfile.backend` - Build do backend
- `Dockerfile.frontend` - Build do frontend
- `docker-compose.yml` - Configuração do Docker Compose

## Suporte

Se tiver problemas no deploy:

1. Verifique os logs (Docker ou servidor)
2. Confirme que as variáveis de ambiente estão corretas
3. Verifique conectividade com Pipedrive API
4. Verifique que frontend/dist/ foi compilado
