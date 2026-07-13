require('dotenv').config();
const GoogleAdsApi = require('google-ads-api').default;

async function test() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 TESTANDO GOOGLE ADS API DIRETO');
  console.log('='.repeat(60) + '\n');

  try {
    const client = new GoogleAdsApi({
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN
    });

    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
    
    console.log(`📊 Puxando dados da conta: ${customerId}\n`);

    const campaigns = await client.Customer.query(customerId, {
      entity: 'campaign',
      attributes: ['campaign.id', 'campaign.name', 'campaign.status'],
      limit: 10
    });

    console.log('✅ SUCESSO! Dados obtidos:\n');
    console.log(`Total de campanhas: ${campaigns.length}\n`);

    campaigns.forEach((c, i) => {
      console.log(`${i+1}. ${c.campaign.name}`);
      console.log(`   ID: ${c.campaign.id}`);
      console.log(`   Status: ${c.campaign.status}\n`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

test();
