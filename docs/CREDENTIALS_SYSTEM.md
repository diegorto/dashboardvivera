# 🔐 Sistema de Credenciais - Vivera Command Center

## Visão Geral

Este documento descreve como as credenciais são gerenciadas, protegidas e podem ser recuperadas no Vivera Command Center.

---

## 📍 Onde as Credenciais São Armazenadas

### 1. **Variáveis de Ambiente (`.env`)**
- **Localização**: `/home/user/dashboardvivera/.env`
- **Proteção**: Arquivo em `.gitignore` - não será commitado
- **Permissões**: `600` (leitura/escrita apenas para proprietário)
- **Uso**: Carregado no startup do servidor

### 2. **Configurações SaaS (`config/settings.json`)**
- **Localização**: `/home/user/dashboardvivera/config/settings.json`
- **Proteção**: Arquivo em `.gitignore` - não será commitado
- **Permissões**: `600` (leitura/escrita apenas para proprietário)
- **Uso**: Configurações aplicadas em tempo real via painel

### 3. **Arquivo de Exemplo (`.env.example`)**
- **Localização**: `/home/user/dashboardvivera/.env.example`
- **Proteção**: Arquivo de referência APENAS (sem valores reais)
- **Uso**: Template para restauração/configuração nova

---

## 🔄 Fluxo de Carregamento de Credenciais

```
Startup do Servidor
    ↓
1. Carrega variáveis de .env (process.env)
    ↓
2. Carrega config/settings.json (se existir)
    ↓
3. Aplica settings.json sobre .env (sobrescrita)
    ↓
4. Valida credenciais com cada serviço
    ↓
5. Inicia cache aquecido (warmCache)
```

---

## 🛠️ Como Atualizar Credenciais

### Método 1: Painel Web (Recomendado)

```
1. Acesse: http://seu-ip:3000/configuracoes
2. Seção: Integrações → Conexões
3. Cole a nova credencial no campo
4. Clique: "Salvar Configurações"
5. Valide: "Testar Conexões"
```

**Resultado**: Salva em `config/settings.json` + aplica em tempo real

### Método 2: Arquivo `.env` Direto

```bash
# Editar arquivo
nano /home/user/dashboardvivera/.env

# Atualizar valor
PIPEDRIVE_TOKEN=novo_token_aqui

# Salvar (Ctrl+O, Enter, Ctrl+X)

# Reiniciar servidor
pm2 restart dashboardvivera
```

**Resultado**: Carrega na próxima reinicialização

---

## 💾 Backup Automático de Credenciais

### Script de Backup

```bash
# Backup com versionamento
./scripts/backup-credentials.sh

# Ou especificar destino
./scripts/backup-credentials.sh /backup/credentials
```

**Cria**: Diretório `vivera-credentials-YYYYMMDD_HHMMSS/`
**Contém**:
- `.env` (credenciais atuais)
- `config/settings.json` (configurações)
- `INFO.txt` (metadados do backup)

**Permissões**: 600 (seguro)

### Automatizar Backups (Cron)

```bash
# Editar crontab
crontab -e

# Adicionar linha (backup diário às 2 AM)
0 2 * * * /home/user/dashboardvivera/scripts/backup-credentials.sh >> /var/log/vivera-backup.log 2>&1
```

---

## 🔄 Restaurar Credenciais do Backup

### Via Script

```bash
# Listar backups disponíveis
ls -1 ~/vivera-credentials-backup

# Restaurar do backup mais recente
./scripts/restore-credentials.sh ~/vivera-credentials-backup/vivera-credentials-20260716_150000
```

**O script irá**:
1. ✅ Fazer backup de emergência das credenciais atuais
2. ✅ Restaurar arquivos do backup
3. ✅ Oferecer reiniciar o servidor
4. ✅ Guardar caminho de recuperação em caso de erro

### Via Manual (Se script falhar)

```bash
# 1. Copiar arquivo .env
cp /seu/backup/path/.env /home/user/dashboardvivera/.env

# 2. Restaurar config se existir
cp /seu/backup/path/config/settings.json /home/user/dashboardvivera/config/

# 3. Ajustar permissões
chmod 600 /home/user/dashboardvivera/.env
chmod 600 /home/user/dashboardvivera/config/settings.json

# 4. Reiniciar
pm2 restart dashboardvivera
```

---

## 🔐 Segurança: Checklist

### ✅ Proteções Implementadas

- [x] `.env` no `.gitignore` - não será commitado por acidente
- [x] `config/settings.json` no `.gitignore` - protegido
- [x] Permissões `600` em arquivos sensíveis - legível apenas pelo owner
- [x] Tokens mascarados no painel web - não mostra valores completos
- [x] Scripts de backup/restore com confirmações - pede confirmação
- [x] Backup de emergência automático - salva antes de restaurar
- [x] Validação via teste de conexões - verifica antes de usar

### ⚠️ Cuidados Adicionais

**NUNCA**:
- ❌ Commite `.env` no git
- ❌ Compartilhe credenciais por email/Slack
- ❌ Use credenciais pessoais em produção
- ❌ Deixe tokens antigos ativos
- ❌ Faça push de backups para repositórios públicos

**SEMPRE**:
- ✅ Use o painel de Configurações para atualizar
- ✅ Teste as conexões após atualizar
- ✅ Mantenha backups em local seguro
- ✅ Revogue tokens quando trocar
- ✅ Criptografe backups remotos

---

## 📊 Credenciais Suportadas

| Serviço | Campo | Tipo | Restauração |
|---------|-------|------|------------|
| **Pipedrive** | `PIPEDRIVE_TOKEN` | API Token | ✅ Automática |
| **Meta Ads** | `FB_ACCESS_TOKEN` | Access Token | ✅ Automática |
| **Meta Ads** | `FB_AD_ACCOUNT_IDS` | Comma-separated | ✅ Automática |
| **Tintim** | `TINTIM_ACCOUNT_CODE` | UUID | ✅ Automática |
| **Tintim** | `TINTIM_ACCOUNT_TOKEN` | Bearer Token | ✅ Automática |
| **Google Ads** | `GOOGLE_ADS_CUSTOMER_ID` | ID Numérico | ✅ Automática |
| **Google Ads** | `GOOGLE_ADS_DEVELOPER_TOKEN` | Token | ✅ Automática |
| **Google Ads** | `GOOGLE_ADS_REFRESH_TOKEN` | OAuth Token | ✅ Automática |
| **Google OAuth** | `GOOGLE_OAUTH_CLIENT_ID` | OAuth ID | ✅ Automática |
| **Google OAuth** | `GOOGLE_OAUTH_CLIENT_SECRET` | Secret | ✅ Automática |
| **OpenAI** | `OPENAI_API_KEY` | API Key | ✅ Automática |

---

## 🚨 Procedimento de Emergência

### Se Credenciais Foram Perdidas

```bash
# PASSO 1: Verifique se há backup
ls -la ~/vivera-credentials-backup/

# PASSO 2: Restaure do backup mais recente
./scripts/restore-credentials.sh ~/vivera-credentials-backup/vivera-credentials-20260716_150000

# PASSO 3: Valide as conexões
curl http://localhost:3000/api/settings/test

# PASSO 4: Se falhar, recupere do backup de emergência
ls -la /home/user/dashboardvivera/.env.backup.*
cp /home/user/dashboardvivera/.env.backup.1689500000 /home/user/dashboardvivera/.env
pm2 restart dashboardvivera
```

### Se Tudo Falhar

1. Obtenha os tokens originais de cada plataforma
2. Cole manualmente no painel de Configurações
3. Teste cada conexão individualmente
4. Documente o incidente

---

## 📞 Suporte e Troubleshooting

### Verificar Status Atual
```bash
# Ver credenciais carregadas (valores mascarados)
curl http://localhost:3000/api/settings

# Testar cada conexão
curl -X POST http://localhost:3000/api/settings/test

# Ver logs
pm2 logs dashboardvivera
```

### Erros Comuns

**Erro: "Pipedrive não configurado"**
- → Verifique se `PIPEDRIVE_TOKEN` está preenchido
- → Valide o token em https://www.pipedrive.com

**Erro: "Meta não configurado"**
- → Verifique `FB_ACCESS_TOKEN` e `FB_AD_ACCOUNT_IDS`
- → Valide em https://www.facebook.com/business

**Erro: "Token inválido"**
- → Token expirou ou foi revogado
- → Obtenha um novo token
- → Atualize via painel de Configurações

---

## 📚 Referências

- **Arquivo de Configuração**: `.env.example`
- **Backup & Restore**: `scripts/backup-credentials.sh`, `scripts/restore-credentials.sh`
- **Documentação Backup**: `CREDENTIALS_BACKUP.md`
- **Painel Web**: `http://seu-ip:3000/configuracoes`

---

**Última atualização**: 2026-07-16
**Versão**: 1.0
**Status**: ✅ Production Ready
