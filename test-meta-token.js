require('dotenv').config();
const axios = require('axios');

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const FB_AD_ACCOUNT_IDS = (process.env.FB_AD_ACCOUNT_IDS || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

async function testMetaToken() {
  console.log('\n=== Teste de Autenticação Meta ===\n');

  if (!FB_ACCESS_TOKEN) {
    console.error('❌ FB_ACCESS_TOKEN não configurado no arquivo .env');
    console.log('\nCrie um arquivo .env com:');
    console.log('FB_ACCESS_TOKEN=seu_token_aqui');
    console.log('FB_AD_ACCOUNT_IDS=conta1,conta2\n');
    process.exit(1);
  }

  try {
    // Testa 1: Verificar informações do token
    console.log('1️⃣  Testando informações do token...');
    const tokenInfoResponse = await axios.get(
      `https://graph.facebook.com/v18.0/me`,
      { params: { access_token: FB_ACCESS_TOKEN, fields: 'id,name,email' } }
    );

    const tokenInfo = tokenInfoResponse.data;
    console.log('✅ Token válido!');
    console.log(`   ID: ${tokenInfo.id}`);
    console.log(`   Nome: ${tokenInfo.name}`);
    console.log(`   Email: ${tokenInfo.email}\n`);

    // Testa 2: Listar contas de anúncios
    console.log('2️⃣  Listando contas de anúncios disponíveis...');
    const accountsResponse = await axios.get(
      `https://graph.facebook.com/v18.0/me/adaccounts`,
      {
        params: {
          access_token: FB_ACCESS_TOKEN,
          fields: 'id,name,business_city,currency',
          limit: 100
        }
      }
    );

    const accounts = accountsResponse.data.data || [];
    if (accounts.length === 0) {
      console.warn('⚠️  Nenhuma conta de anúncios encontrada');
    } else {
      console.log(`✅ ${accounts.length} conta(s) de anúncios encontrada(s):\n`);
      accounts.forEach((acc, idx) => {
        console.log(`   ${idx + 1}. ID: ${acc.id}`);
        console.log(`      Nome: ${acc.name}`);
        console.log(`      Moeda: ${acc.currency}`);
        console.log(`      Cidade: ${acc.business_city || 'N/A'}\n`);
      });
    }

    // Testes 3: Verificar acesso às contas configuradas
    console.log('3️⃣  Verificando acesso às contas configuradas no .env...');
    if (FB_AD_ACCOUNT_IDS.length === 0) {
      console.warn('⚠️  Nenhuma conta configurada em FB_AD_ACCOUNT_IDS\n');
    } else {
      for (const accountId of FB_AD_ACCOUNT_IDS) {
        try {
          const insightsResponse = await axios.get(
            `https://graph.facebook.com/v18.0/act_${accountId}/insights`,
            {
              params: {
                access_token: FB_ACCESS_TOKEN,
                fields: 'account_id,account_name,spend',
                date_preset: 'last_30d'
              }
            }
          );

          const insight = insightsResponse.data.data?.[0] || {};
          console.log(`   ✅ Conta ${accountId}: Acesso OK`);
          if (insight.account_name) {
            console.log(`      Nome: ${insight.account_name}`);
          }
          if (insight.spend) {
            console.log(`      Gasto (30d): $${insight.spend}`);
          }
          console.log();
        } catch (error) {
          console.log(`   ❌ Conta ${accountId}: ${error.response?.data?.error?.message || error.message}`);
          console.log();
        }
      }
    }

    // Resumo final
    console.log('=== Resumo ===');
    console.log('✅ Autenticação Meta OK!');
    console.log(`✅ ${accounts.length} conta(s) de anúncios disponível(eis)`);
    console.log(`✅ ${FB_AD_ACCOUNT_IDS.length} conta(s) configurada(s) no .env\n`);

  } catch (error) {
    console.error('\n❌ Erro ao testar token Meta:');
    if (error.response?.data?.error) {
      const err = error.response.data.error;
      console.error(`   Tipo: ${err.type}`);
      console.error(`   Mensagem: ${err.message}`);
      console.error(`   Código: ${err.code}`);
    } else {
      console.error(`   ${error.message}`);
    }
    console.log('\nDicas:');
    console.log('1. Verifique se o token FB_ACCESS_TOKEN está correto');
    console.log('2. Verifique se o token não expirou');
    console.log('3. Verifique se o token tem permissão para acessar ads (escopo: ads_read)');
    console.log('4. Verifique se a conta está ativa no Meta Business Suite\n');
    process.exit(1);
  }
}

testMetaToken();
