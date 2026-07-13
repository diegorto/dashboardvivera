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

  // Verifica se as credenciais estão configuradas
  console.log('Verificando credenciais configuradas:');
  console.log('  - DEVELOPER_TOKEN:', credentials.developer_token ? '✓ Configurado' : '✗ NÃO CONFIGURADO');
  console.log('  - CLIENT_ID:', credentials.client_id ? '✓ Configurado' : '✗ NÃO CONFIGURADO');
  console.log('  - CLIENT_SECRET:', credentials.client_secret ? '✓ Configurado' : '✗ NÃO CONFIGURADO');
  console.log('  - REFRESH_TOKEN:', credentials.refresh_token ? '✓ Configurado' : '✗ NÃO CONFIGURADO');

  if (!Object.values(credentials).every(v => v)) {
    console.log('\n⚠️  Erro: Nem todas as credenciais estão configuradas!');
    console.log('Configure o arquivo .env com as variáveis necessárias.\n');
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

    // Busca lista de contas do Google Ads
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;

    if (!customerId) {
      console.log('⚠️  GOOGLE_ADS_CUSTOMER_ID não configurado.');
      console.log('Use um Customer ID no formato: 1234567890 (sem hífens)\n');
      process.exit(1);
    }

    console.log(`🔍 Buscando informações da conta: ${customerId}\n`);

    // Teste de conexão: busca informações básicas da campanha
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

    // Teste de token: decodifica informações do refresh token
    console.log('📋 Informações do Token:\n');
    console.log(`  - Developer Token: ${credentials.developer_token.substring(0, 10)}...`);
    console.log(`  - Customer ID: ${customerId}`);
    console.log(`  - Cliente OAuth: ${credentials.client_id.substring(0, 20)}...\n`);

    console.log('✨ Teste concluído com sucesso!\n');

  } catch (error) {
    console.error('\n❌ Erro ao conectar:\n');

    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('  Erro de autenticação. Verifique:');
      console.error('  - Se o refresh_token ainda é válido');
      console.error('  - Se o client_id e client_secret estão corretos\n');
    } else if (error.message.includes('400') || error.message.includes('Customer ID')) {
      console.error('  Erro no Customer ID. Verifique:');
      console.error('  - Se o Customer ID está no formato correto (sem hífens)');
      console.error('  - Se a conta existe e está acessível\n');
    } else {
      console.error(`  ${error.message}\n`);
    }

    console.log('Dica: Use o Google Ads Playground para validar suas credenciais:');
    console.log('  https://developers.google.com/google-ads/api/fields/latest/overview\n');

    process.exit(1);
  }
}

testGoogleAdsToken();
