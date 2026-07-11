# Infraestrutura de Deployment

## Servidores

### Servidor Remoto (Produção)
- **Host**: 187.77.249.55
- **Porta**: 3000
- **URL**: http://187.77.249.55:3000
- **Caminho do projeto**: /home/user/dashboardvivera
- **Usuário SSH**: root

### Servidor Local (Desenvolvimento)
- **URL**: http://localhost:3000

## Bug Corrigido - TEMPO ORÇAMENTO → VENDA

### Problema
A coluna "TEMPO ORÇAMENTO → VENDA" (tempoOrcamentoVenda) estava sempre mostrando "—" (vazio) na página de Pacientes.

### Causa
No arquivo `server.js`, na função `getDataComparecimento()`, o código estava acessando `e.log_time` diretamente, mas os dados do Pipedrive vêm em uma estrutura aninhada: `e.data.log_time`.

**Código bugado (linha 428):**
```javascript
return e.log_time ? e.log_time.slice(0, 10) : null;  // ERRADO
```

**Código corrigido (linha 428-429):**
```javascript
const logTime = e.data.log_time || e.timestamp;
return logTime ? logTime.slice(0, 10) : null;  // CORRETO
```

### Cálculo Correto
O tempo é calculado em `buildPatients()` como:
```javascript
const dataBase = deal.dataComparecimento || deal.addDate;
if (deal.wonDate && dataBase) {
  tempoOrcamentoVenda = Math.round((new Date(deal.wonDate) - new Date(dataBase)) / 86400000);
}
```

Usa a data de comparecimento (quando entrou no estágio de Comparecimento), ou fallback para data do lead.

## Deploy no Servidor Remoto

### Procedimento
1. SSH para o servidor:
   ```bash
   ssh root@187.77.249.55
   ```

2. Entre no diretório do projeto:
   ```bash
   cd /home/user/dashboardvivera
   ```

3. Atualize o código:
   ```bash
   git pull origin claude/meta-pipe-api-integration-luq1ht
   ```

4. Mate o processo antigo:
   ```bash
   pkill -f "node.*server.js"
   ```

5. Inicie o servidor:
   ```bash
   npm start &
   ```

6. Atualize o navegador (F5 ou Ctrl+R)

### Webhook de Deploy (NÃO FUNCIONA ATUALMENTE)
Arquivo: `deploy-via-webhook.sh`
- O webhook em `http://187.77.249.55:3000/webhook/github-deploy` não está acessível do ambiente de desenvolvimento
- Use o procedimento manual acima

## Estrutura de Dados - Deal Flow Events (Pipedrive)

Quando você faz uma requisição para `/deals/{id}/flow` no Pipedrive, os eventos têm esta estrutura:

```javascript
{
  object: "dealChange",
  data: {
    field_key: "stage_id",
    old_value: "4",
    new_value: "5",
    log_time: "2026-07-09 10:30:00"  // ← SEMPRE use e.data.log_time
  },
  timestamp: "2026-07-09T10:30:00Z",
  user_id: 12345
}
```

**Importante**: Sempre acesse `e.data.log_time`, não `e.log_time` diretamente!

## Informações Importantes para Lembrar

- **Sempre verificar o path do projeto** no servidor remoto (pode variar por deploy)
- **SSH acesso necessário** para fazer deploy manual
- **Webhook não funciona** porque o servidor remoto não está acessível da rede
- **Git branch para deploy**: `claude/meta-pipe-api-integration-luq1ht`
- **Configuração local**: `.env` (não commitado no git)
- **Configuração produção**: `config.json` (não commitado, só no deploy via webhook)

## Funnel - Motivos de Perda e Objeções

### Mudanças Implementadas
1. **Extração de Loss Reason**: Agora extrai `loss_reason_id` do Pipedrive para cada deal perdido
2. **Mapa de Motivos**: Constante `LOSS_REASONS` mapeia IDs para motivos (ex: Distância, Sem interesse, Objeção financeira)
3. **Display no Funil**: 
   - Motivos de perda em **vermelho** abaixo de cada etapa
   - Tags de objeção em **amarelo** quando expande a etapa
   - Separação clara com contagem de cada motivo/tag

### Estrutura de Dados Atualizada
- **FunnelStage** agora inclui `motivosPerdas: FunnelLossReason[]`
- **FunnelLossReason**: `{ motivo: string, count: number }`
- **Objeções** continuam em `objecoes: FunnelObjection[]`

### Valores de Loss Reason (LOSS_REASONS)
```javascript
{
  '1': 'Não qualificado',
  '2': 'Distância/Localização',
  '3': 'Sem interesse',
  '4': 'Objeção financeira',
  '5': 'Medo/Insegurança',
  '6': 'Não respondeu',
  '7': 'Concorrência',
  '8': 'Não compareceu'
}
```

## Debugging

### Verificar se servidor está rodando
```bash
curl http://187.77.249.55:3000/api/dashboard
```

### Ver logs do servidor remoto
```bash
ssh root@187.77.249.55
tail -f /tmp/server.log  # se configurado
# ou use PM2 se disponível
pm2 logs
```

### Testar cálculo localmente
```bash
node server.js
curl "http://localhost:3000/api/dashboard?since=2026-07-01&until=2026-07-11" | jq '.patients[] | select(.nome == "Eliane Luiz")'
```

### Testar Funil com Loss Reasons
```bash
curl "http://localhost:3000/api/funil-real?since=2026-07-01&until=2026-07-11" | jq '.funnel.stages[] | {label, perdidos, motivosPerdas, objecoes}'
```
