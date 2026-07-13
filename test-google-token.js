require('dotenv').config();
const GoogleAdsApi = require('google-ads-api').default;

async function testGoogleAdsToken() {
  const credentials = {
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN
  };

  console.log('\n=== Teste de Autenticação Google Ads ===\n');

  console.log('Verificando credenciais configuradas:');
  console.log('  - DEVELOPER_TOKEN:', credentials.developer_token ? '✓ Configurado' : '✗ NÃO CONFIGURADO');
  console.log('  - CLIENT_ID:', credentials.client_id ? '✓ Configurado' : '✗ NÃO CONFIGURADO');
  console.log('  - CLIENT_SECRET:', credentials.client_secret ? '✓ Configurado' : '✗ NÃO CONFIGURADO');
  console.log('  - REFRESH_TOKEN:', credentials.refresh_token ? '✓ Configurado' : '✗ NÃO CONFIGURADO');

  if (!Object.values(credentials).every(v => v)) {
    console.log('\n⚠️  Erro: Nem todas as credenciais estão configuradas!\n');
    process.exit(1);
  }

  try {
    console.log('\n📡 Conectando ao Google Ads API...\n');

    const client = new GoogleAdsApi({
      developer_token: credentials.developer_token,
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token
    });

    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;

    if (!customerId) {
      console.log('⚠️  GOOGLE_ADS_CUSTOMER_ID não configurado.\n');
      process.exit(1);
    }

    console.log(`🔍 Buscando informações da conta: ${customerId}\n`);

    const response = await client.Customer.query(customerId, {
      entity: 'campaign',
      attributes: ['campaign.id', 'campaign.name', 'campaign.status'],
      limit: 5
    });

    console.log('✅ Conexão bem-sucedida!\n');
    console.log('📊 Primeiras 5 campanhas encontradas:\n');

    if (response && response.length > 0) {
      response.forEach((campaign, index) => {
        console.log(`  ${index + 1}. ${campaign.campaign.name}`);
        console.log(`     - ID: ${campaign.campaign.id}`);
        console.log(`     - Status: ${campaign.campaign.status}\n`);
      });
    } else {
      console.log('  (Nenhuma campanha encontrada nesta conta)\n');
    }

    console.log('✨ Teste concluído com sucesso!\n');

  } catch (error) {
    console.error('\n❌ Erro ao conectar:\n');
    console.error(`  ${error.message}\n`);
    process.exit(1);
  }
}

testGoogleAdsToken();
