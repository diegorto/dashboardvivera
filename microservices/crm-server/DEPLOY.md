# Deploy do Vivera CRM na VPS

O CRM é um microserviço novo (`microservices/crm-server`) + telas novas no `web/`.
Nada do que já roda na VPS é alterado — só entra coisa nova.

## O que sobe

| Peça | O quê | Onde |
|---|---|---|
| Banco | MySQL `vivera_crm` (schema + estrutura real dos funis) | MySQL local da VPS |
| API | `crm-server` porta 3005 (login JWT, kanban, pacientes, webhook Tintim) | PM2 `vivera-crm` |
| Varredura | cron interno 02:00 America/Sao_Paulo confere dados com o Pipedrive | dentro do crm-server |
| Telas | `/crm`, `/crm/pacientes`, `/crm/login` no site | build do `web/` |
| Dados | import dos CSVs de negócios + pessoas (pasta `data-import/`) | scripts de import |

## Passo a passo

1. Atualizar o código na VPS (git pull do branch com o CRM, ou descompactar o pacote
   `vivera-crm-deploy.tar.gz` por cima da pasta do repositório).
2. Colocar os dois CSVs do Pipedrive em `microservices/crm-server/data-import/`:
   - `deals.csv` (export de negócios)
   - `people.csv` (export de pessoas)
3. Rodar:
   ```bash
   cd microservices/crm-server
   bash deploy-crm.sh
   ```
4. Configurar o proxy do site → API (uma vez só). No nginx (ou equivalente) do domínio:
   ```nginx
   location /api/crm/ { proxy_pass http://127.0.0.1:3005/api/crm/; }
   ```
   Se o site roda na Vercel, criar um subdomínio (ex.: `api.viveraorofacial.com`)
   apontando para a VPS com HTTPS e adicionar em `vercel.json`:
   ```json
   { "rewrites": [{ "source": "/api/crm/:path*", "destination": "https://api.viveraorofacial.com/api/crm/:path*" }] }
   ```
5. Adicionar `PIPEDRIVE_TOKEN` no `.env` do crm-server e `pm2 restart vivera-crm`
   (sem o token o CRM funciona normal; só a varredura de conferência fica aguardando).
6. Apontar o webhook do Tintim para
   `https://SEU-DOMINIO/api/crm/webhooks/tintim?secret=<TINTIM_WEBHOOK_SECRET do .env>`.

## Verificação pós-deploy

```bash
curl -s localhost:3005/api/crm/health           # deve responder success:true
pm2 logs vivera-crm --lines 20                  # sem erros
mysql vivera_crm -e "SELECT COUNT(*) FROM deals" # ~2467
```

Login inicial: `diegoandreiaguiar@gmail.com` / senha definida no deploy (padrão `vivera2026` — trocar).

## Varredura das 2h

Roda sozinha todo dia às 02:00 (fuso de São Paulo) dentro do processo PM2 — não depende
de computador ligado. Orçamento de 500 chamadas/noite à API do Pipedrive; avança um cursor
até conferir 100% dos negócios e recomeça. Acompanhe em `GET /api/crm/sync/status` ou na
tabela `sync_runs`.
