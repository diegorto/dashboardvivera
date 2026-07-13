# Setup Google Ads API

## Como obter as credenciais do Google Ads

### 1. Developer Token
- Acesse: https://ads.google.com/aw/apicenter
- Vá em "Settings" > "API Center"
- Copie seu **Developer Token**

### 2. Criar um Projeto no Google Cloud Console
1. Acesse: https://console.cloud.google.com/
2. Crie um novo projeto
3. Procure por "Google Ads API" e ative-a
4. Vá para "Credentials"
5. Clique em "Create Credentials" > "OAuth 2.0 Client ID"
6. Selecione "Web application"
7. Adicione a seguinte URL aos "Authorized redirect URIs":
   - `http://localhost:3000/auth/google/callback` (para desenvolvimento)
8. Copie **Client ID** e **Client Secret**

### 3. Obter Refresh Token
Você precisa fazer uma autenticação OAuth inicial para obter o refresh token.

**Opção A: Usar o script de autenticação**

Crie um arquivo `auth-google.js`:

```javascript
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  'seu_client_id.apps.googleusercontent.com',
  'seu_client_secret',
  'http://localhost:3000/auth/google/callback'
);

// Gera URL de autenticação
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/adwords']
});

console.log('Abra esta URL no navegador:');
console.log(authUrl);
```

Execute: `node auth-google.js`

1. Clique no link gerado
2. Autorize o acesso
3. Você será redirecionado para uma URL com um código
4. Use esse código para obter o refresh token

**Opção B: Usar Google Ads Playground**
- Acesse: https://developers.google.com/google-ads/api/reference/rpc
- Faça login com sua conta Google Ads
- Copie o token gerado

### 4. Customer ID
Seu Customer ID pode ser encontrado em:
- Google Ads Dashboard > Settings > Account settings
- Formato: `1234567890` (10 dígitos, sem hífens)

## Configurar as Variáveis de Ambiente

1. Crie um arquivo `.env` baseado em `.env.example`:
   ```bash
   cp .env.example .env
   ```

2. Preenchaa com suas credenciais:
   ```
   GOOGLE_ADS_DEVELOPER_TOKEN=seu_token_aqui
   GOOGLE_ADS_CLIENT_ID=seu_client_id.apps.googleusercontent.com
   GOOGLE_ADS_CLIENT_SECRET=seu_client_secret
   GOOGLE_ADS_REFRESH_TOKEN=seu_refresh_token
   GOOGLE_ADS_CUSTOMER_ID=1234567890
   ```

## Testar a Conexão

Execute o teste rápido:

```bash
node test-google-token.js
```

Você deve ver:
- ✓ Verificação das credenciais configuradas
- ✓ Conexão bem-sucedida
- ✓ Lista das primeiras campanhas

## Troubleshooting

### Erro "Unauthorized" (401)
- O refresh token expirou - faça uma nova autenticação OAuth
- Client ID ou Client Secret estão incorretos

### Erro "Invalid Customer ID"
- Verifique se o Customer ID está no formato correto (sem hífens)
- A conta pode estar desabilitada

### Erro "Developer Token not approved"
- Aguarde a aprovação do developer token pela Google
- Geralmente leva 24-48 horas

## Recursos Úteis

- [Google Ads API Docs](https://developers.google.com/google-ads/api/docs/start)
- [API Center](https://ads.google.com/aw/apicenter)
- [Google Cloud Console](https://console.cloud.google.com/)
