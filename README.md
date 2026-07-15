# Executive OS - Agente Autônomo de Sincronização de Dados

Agente de governança de dados que sincroniza **Clairis** → **Staging** → **Auditoria** → **Aprovação** → **Pipedrive** → **Executive OS**.

## 📋 Pré-requisitos

- Docker & Docker Compose
- Python 3.11+ (para desenvolvimento local)
- 4GB RAM mínimo
- Conexão com internet

## 🚀 Quick Start

### 1. Clonar e configurar

```bash
cd /home/user/dashboardvivera
cp .env.example .env
```

### 2. Editar `.env` com credenciais

```env
CLAIRIS_EMAIL=comet.ia@vivera.com.br
CLAIRIS_PASSWORD=CometIA@2026
PIPEDRIVE_API_TOKEN=seu_token_aqui
```

### 3. Iniciar com Docker

```bash
docker-compose up -d
```

Esto inicia:
- PostgreSQL (banco de dados)
- Redis (cache)
- Agent (sincronização)
- Grafana (dashboard)
- Prometheus (monitoramento)

### 4. Verificar status

```bash
docker-compose logs -f agent
```

## 📊 Acessar Interfaces

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **PostgreSQL**: localhost:5432

## 🔄 Fluxo de Dados

1. **02:00** - Login Clairis
2. **02:05** - Exporta 11 planilhas
3. **02:20** - Valida estrutura
4. **02:30** - Importa para Staging
5. **02:40** - Normaliza dados
6. **02:50** - Compara Clairis vs Pipedrive
7. **03:10** - Gera auditoria
8. **03:20** - Cria fila de aprovação
9. **~Aguarda aprovação~**
10. **→** Atualiza Pipedrive
11. **→** Atualiza Executive OS
12. **→** Calcula jornada de pacientes
13. **→** Atualiza KPIs

## 📁 Estrutura do Projeto

```
dashboardvivera/
├── src/
│   ├── core/                    # Config, DB, Logger
│   ├── clairis/                 # Login e exportação
│   ├── staging/                 # Banco temporário
│   ├── normalization/           # Padronização
│   ├── comparison/              # Matching inteligente
│   ├── audit/                   # Auditoria com IA
│   ├── approval/                # Fila de aprovação
│   ├── journey/                 # Análise de jornada
│   ├── pipedrive/               # Sincronização CRM
│   ├── executive_os/            # Banco principal
│   └── main.py                  # Orquestrador
├── migrations/                  # SQL inicial
├── data/
│   ├── exports/                 # Planilhas exportadas
│   └── staging/                 # Dados normalizados
├── logs/                        # Arquivos de log
└── docs/                        # Documentação
```

## 🔐 Segurança

- ✅ Credenciais em variáveis de ambiente
- ✅ Aprovação obrigatória antes de atualizar CRM
- ✅ Auditoria de todas as ações
- ✅ Logs estruturados permanentes
- ✅ Nunca apaga registros
- ✅ Sincronização incremental (upsert)

## 📝 Logs

Logs em tempo real:

```bash
docker-compose logs -f agent

# Ver logs por etapa
grep "export\|validation\|staging" logs/*.log
```

## 🧪 Desenvolvimento Local

```bash
# Instalar dependências
pip install -r requirements.txt

# Executar testes
pytest tests/

# Executar linter
black src/

# Executar sincronização manual
python -m src.main
```

## 🛠️ Troubleshooting

### Agent não inicia
```bash
docker-compose down
docker-compose up -d --build
```

### Erro de conexão Clairis
- Verificar credenciais em `.env`
- Verificar se Clairis está acessível
- Ver logs: `docker-compose logs agent`

### Banco de dados não inicializa
```bash
docker-compose exec postgres psql -U executive_os -d executive_os -f /docker-entrypoint-initdb.d/init.sql
```

## 📞 Support

Para dúvidas ou problemas, verifique:
- `docs/ARCHITECTURE.md` - Arquitetura detalhada
- Logs estruturados em `logs/`
- Status no Grafana: http://localhost:3000

---

**Desenvolvido com ❤️ para Executive OS**
