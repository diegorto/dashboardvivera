const axios = require('axios');

const PIPEBOARD_API_KEY = process.env.PIPEBOARD_API_KEY || '';
const PIPEBOARD_META_ADS_BASE_URL = 'https://meta-ads.mcp.pipeboard.co/';

// Criar client com autenticação Bearer token
const metaAdsClient = axios.create({
  baseURL: PIPEBOARD_META_ADS_BASE_URL,
  headers: {
    'Authorization': `Bearer ${PIPEBOARD_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Conecta ao Pipeboard Meta Ads via MCP autenticado
 */
async function testConnection() {
  try {
    if (!PIPEBOARD_API_KEY) {
      return {
        success: false,
        message: 'Pipeboard API Key não configurada'
      };
    }

    console.log('Testando conexão com Pipeboard Meta Ads MCP...');

    // Teste simples - tentar listar contas
    const response = await metaAdsClient.post('/', {
      method: 'list_facebook_ad_accounts'
    });

    console.log('✅ Conexão com Pipeboard Meta Ads MCP bem-sucedida');

    return {
      success: true,
      message: 'Conectado ao Pipeboard Meta Ads MCP',
      data: response.data
    };
  } catch (error) {
    console.error('❌ Erro ao testar conexão:', error.message);
    return {
      success: false,
      message: `Erro ao conectar: ${error.message}`
    };
  }
}

/**
 * Busca contas de anúncios do Meta via Pipeboard MCP
 */
async function getAccounts() {
  try {
    console.log('Buscando contas Meta Ads...');

    const response = await metaAdsClient.post('/', {
      method: 'list_facebook_ad_accounts'
    });

    console.log(`✅ ${response.data.total_accounts || response.data.accounts?.length || 0} contas encontradas`);
    return response.data.accounts || [];
  } catch (error) {
    console.error('Erro ao buscar contas:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Busca campanhas de um anúncio do Meta via Pipeboard MCP
 */
async function getCampaigns(accountId) {
  try {
    if (!accountId) {
      throw new Error('Account ID é obrigatório');
    }

    console.log(`Buscando campanhas para conta Meta: ${accountId}`);

    const response = await metaAdsClient.post('/', {
      method: 'get_facebook_ad_campaigns',
      params: {
        account_id: accountId.toString()
      }
    });

    console.log(`✅ ${response.data.total_campaigns || response.data.campaigns?.length || 0} campanhas encontradas`);
    return response.data.campaigns || [];
  } catch (error) {
    console.error('Erro ao buscar campanhas:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Busca métricas de performance do Meta via Pipeboard MCP
 */
async function getMetrics(accountId, dateRange = 'LAST_30_DAYS') {
  try {
    if (!accountId) {
      throw new Error('Account ID é obrigatório');
    }

    console.log(`Buscando métricas para conta Meta: ${accountId}, período: ${dateRange}`);

    const response = await metaAdsClient.post('/', {
      method: 'get_facebook_ad_metrics',
      params: {
        account_id: accountId.toString(),
        date_range: dateRange,
        breakdown: 'campaign'
      }
    });

    console.log(`✅ Métricas carregadas para ${response.data.returned_campaigns || 0} campanhas`);
    return response.data.campaigns || [];
  } catch (error) {
    console.error('Erro ao buscar métricas:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Busca leads/conversões do Meta via Pipeboard MCP
 */
async function getConversions(accountId, dateRange = 'LAST_30_DAYS') {
  try {
    if (!accountId) {
      throw new Error('Account ID é obrigatório');
    }

    console.log(`Buscando conversões para conta Meta: ${accountId}`);

    const metrics = await getMetrics(accountId, dateRange);

    // Filtrar apenas campanhas com conversões
    const conversions = metrics
      .filter(campaign => campaign.conversions > 0)
      .map(campaign => ({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        conversions: campaign.conversions,
        conversion_value: campaign.conversion_value || 0,
        spend: campaign.spend || 0,
        impressions: campaign.impressions || 0,
        clicks: campaign.clicks || 0,
        cpc: (campaign.spend || 0) / (campaign.clicks || 1),
        roas: (campaign.conversion_value || 0) / (campaign.spend || 1)
      }));

    console.log(`✅ ${conversions.length} campanhas com conversões`);
    return conversions;
  } catch (error) {
    console.error('Erro ao buscar conversões:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  testConnection,
  getAccounts,
  getCampaigns,
  getMetrics,
  getConversions
};
