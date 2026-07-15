# Vivera Dashboard - Guia de Deployment

## 📋 Pré-requisitos

- Docker & Docker Compose (v3.8+)
- Git
- Node.js 18+ (para desenvolvimento local)
- VPS com Ubuntu 20.04+ ou similar

## 🚀 Deployment com Docker

### 1. Local Setup

```bash
# Clone do repositório
git clone <repository-url>
cd dashboardvivera

# Executar setup
./scripts/setup.sh

# Ou manualmente:
cd backend && npm ci && cd ..
cd frontend && npm ci && cd ..
```

### 2. Development (Local)

#### Opção A: Sem Docker

```bash
# Terminal 1 - Backend
cd backend
npm start
# Roda em http://localhost:3001

# Terminal 2 - Frontend
cd frontend
npm start
# Roda em http://localhost:3000
```

#### Opção B: Com Docker

```bash
docker-compose up --build
```

### 3. Production Deployment

#### Setup no VPS

```bash
# Conectar no VPS
ssh user@your-vps-ip

# Clonar repositório
git clone <repository-url>
cd dashboardvivera

# Fazer deploy
./scripts/deploy.sh production
```

#### Via Docker Compose

```bash
# Build e start
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down
```

## 🔐 Segurança em Produção

### 1. SSL/TLS

```bash
# Gerar certificado (Let's Encrypt)
sudo certbot certonly --standalone -d your-domain.com

# Copiar para pasta ssl/
mkdir -p ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem
sudo chown $USER:$USER ssl/*
```

### 2. Ativar HTTPS no Nginx

Editar `nginx.conf` e descomentar blocos HTTPS.

### 3. Firewall

```bash
# UFW (Ubuntu)
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 4. Environment Variables

```bash
# Criar .env.production
cat > .env.production << 'ENV'
NODE_ENV=production
PORT=3001
API_CORS_ORIGIN=https://your-domain.com
LOG_LEVEL=info
ENV
```

## 📊 Monitoramento

### Logs

```bash
# Ver logs em tempo real
docker-compose logs -f backend
docker-compose logs -f frontend

# Ver logs específicos
docker logs dashboardvivera-backend

# Exportar logs
docker logs dashboardvivera-backend > backend.log 2>&1
```

### Health Checks

```bash
# Backend
curl http://localhost:3001/api/governance/health

# Frontend
curl http://localhost:3000

# Nginx
curl http://localhost/health
```

## 🔄 CI/CD com GitHub Actions

Criar `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_KEY }}
          script: |
            cd /home/app/dashboardvivera
            git pull
            ./scripts/deploy.sh production
```

## 📦 Backup & Recovery

### Backup de Dados

```bash
# Backup do banco de dados (quando integrado)
docker-compose exec postgres pg_dump -U postgres > backup.sql

# Backup de volumes
docker run --rm -v dashboardvivera_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/data.tar.gz -C /data .
```

### Restore

```bash
# Restore do banco
docker-compose exec -T postgres psql -U postgres < backup.sql

# Restore de volumes
docker run --rm -v dashboardvivera_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/data.tar.gz -C /data
```

## 🐛 Troubleshooting

### Backend não conecta

```bash
# Ver logs
docker logs dashboardvivera-backend

# Verificar porta
netstat -tlnp | grep 3001

# Resetar
docker-compose down -v
docker-compose up -d
```

### Frontend mostra erro

```bash
# Limpar cache
docker-compose down
rm -rf frontend/build
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

### Nginx erro 502

```bash
# Verificar backends
docker-compose ps
curl http://backend:3001/api/governance/health
curl http://frontend:3000

# Restartar nginx
docker-compose restart nginx
```

## 📈 Performance Tuning

### Backend

```javascript
// server.js
app.use(compression()); // Gzip
app.use(cors({ origin: process.env.CORS_ORIGIN }));

// Cache headers
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.set('Cache-Control', 'no-cache, no-store');
  } else {
    res.set('Cache-Control', 'public, max-age=3600');
  }
  next();
});
```

### Frontend

```bash
# Analysize bundle
npm run build -- --stats

# Otimizar
npm install react-lazy-load-image-component
```

## 🔄 Atualizações

### Atualizar Dependências

```bash
# Backend
cd backend
npm update
npm audit fix

# Frontend
cd frontend
npm update
npm audit fix
```

### Deploy de Atualizações

```bash
# Git pull
git pull origin main

# Rebuild
docker-compose build --no-cache

# Restart
docker-compose up -d

# Verificar
docker-compose ps
curl http://localhost:3001/api/governance/health
```

## 📞 Suporte

Para erros ou questões:
1. Verificar logs: `docker-compose logs`
2. Testar health checks
3. Verificar conectividade de rede
4. Consultar documentação em `/docs`

---

**Versão**: 1.0.0
**Atualizado**: 2026-07-15
**Branch**: claude/reinice-ren84r
