# 🔐 Backup de Credenciais - Vivera Command Center

## ⚠️ IMPORTANTE - Leia Antes de Continuar

Este arquivo documenta como restaurar as credenciais da API se elas forem perdidas.
**NUNCA commite este arquivo com valores reais!**

---

## 📋 Credenciais Atuais (Backup)

Quando você atualiza as credenciais no painel de **Configurações**, elas são armazenadas em:
- **Arquivo**: `config/settings.json` (armazenado localmente no VPS)
- **Arquivo**: `.env` (NUNCA deve ser commitado - está no .gitignore)

### ✅ Proteção Implementada

1. **`.env` protegido no `.gitignore`** - Não pode ser commitado por acidente
2. **`config/settings.json` protegido no `.gitignore`** - Arquivo de configuração local
3. **Painel de Configurações** - Salve as credenciais via UI em **Configurações → Conexões**

---

## 🔄 Como Restaurar Credenciais

### Opção 1: Via Painel de Configurações (Recomendado)

1. Acesse: `http://seu-ip:3000/configuracoes`
2. Vá para a seção **Integrações**
3. Cole cada credencial nos campos:
   - **Pipedrive API Token**
   - **Meta (Facebook) Access Token**
   - **Meta Ad Account IDs** (separadas por vírgula)
   - **Tintim API Key** (se usar Tintim)
   - **Tintim Workspace ID** (se usar Tintim)
   - **Google Ads Customer ID** (se usar Google Ads)
   - **Google Ads Developer Token** (se usar Google Ads)
   - **OpenAI API Key** (se usar IA)
4. Clique em **Salvar Configurações**
5. Clique em **Testar Conexões** para validar

### Opção 2: Editar `.env` Diretamente

Se o painel não estiver funcionando:

```bash
nano /home/user/dashboardvivera/.env
```

Atualize os valores:
```env
PIPEDRIVE_TOKEN=seu_token_aqui
FB_ACCESS_TOKEN=seu_token_aqui
FB_AD_ACCOUNT_IDS=id1,id2,id3
TINTIM_ACCOUNT_CODE=seu_code
TINTIM_ACCOUNT_TOKEN=seu_token
GOOGLE_ADS_CUSTOMER_ID=seu_id
GOOGLE_ADS_DEVELOPER_TOKEN=seu_token
```

Depois reinicie o servidor:
```bash
pm2 restart dashboardvivera
```

---

## 📚 Referência de Credenciais

### Pipedrive
- **Tipo**: API Token
- **Onde obter**: Pipedrive → Settings → API → Your companies API token
- **Formato**: Hash alfanumérico (32 caracteres)
- **Link**: https://www.pipedrive.com/en/features/integrations

### Meta (Facebook)
- **Tipo**: Access Token + Ad Account IDs
- **Onde obter**: Meta Business Suite → Settings → Users and Permissions
- **Formato**: Token longo + IDs numéricos
- **Link**: https://www.facebook.com/business/tools/ads-manager

### Tintim
- **Tipo**: Account Code + Account Token
- **Onde obter**: Tintim → Account Settings → API Keys
- **Formato**: UUID + Bearer token
- **Link**: https://tintim.io

### Google Ads
- **Tipo**: Customer ID + Developer Token + Refresh Token
- **Onde obter**: Google Ads → Tools → Settings → Developer Token
- **Link**: https://ads.google.com

### OpenAI (Opcional)
- **Tipo**: API Key
- **Onde obter**: OpenAI → API Keys → Create new secret key
- **Formato**: `sk-...`
- **Link**: https://platform.openai.com/account/api-keys

---

## 🛡️ Boas Práticas de Segurança

✅ **FAÇA:**
- Salve credenciais via painel de Configurações
- Teste conexões regularmente
- Use tokens/chaves específicas por integração
- Revogue tokens antigos quando trocar

❌ **NÃO FAÇA:**
- Commitar `.env` no git
- Compartilhar credenciais por email/Slack
- Usar credenciais pessoais em produção
- Deixar tokens antigos ativos

---

## 📱 Status das Integrações

Acesse **Configurações → Conexões** para ver o status em tempo real:

| Integração | Status | Ação |
|-----------|--------|------|
| Pipedrive | ✅ Configurado | Teste |
| Meta Ads | ✅ Configurado | Teste |
| Google Ads | ✅ Configurado | Teste |
| Tintim | ✅ Configurado | Teste |
| OpenAI | ⚠️ Opcional | Teste |

---

## 🚨 Se Credenciais Forem Perdidas

1. **Não pânico** - Use este documento
2. **Reúna os tokens** - Obtenha os valores atuais de cada plataforma
3. **Restaure via painel** - Prefira o painel de Configurações
4. **Teste conexões** - Valide antes de usar
5. **Contate suporte** - Se algo não funcionar

---

## 📞 Suporte

Se precisar de ajuda:
- **Documentação**: Veja `.env.example`
- **Configurações**: `config/settings.json` (local)
- **Logs**: `pm2 logs dashboardvivera`
- **Status**: POST `/api/settings/test`

---

**Última atualização**: 2026-07-16
**Versão**: 1.0
