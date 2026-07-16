const axios = require('axios');

const PIPEBOARD_API_KEY = process.env.PIPEBOARD_API_KEY || '';
const PIPEBOARD_GOOGLE_ADS_BASE_URL = 'https://google-ads.mcp.pipeboard.co/';

// Criar client com autenticação Bearer token
const googleAdsClient = axios.create({
  baseURL: PIPEBOARD_GOOGLE_ADS_BASE_URL,
  headers: {
    'Authorization': `Bearer ${PIPEBOARD_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Conecta ao Pipeboard Google Ads via MCP autenticado
 */
async function testConnection() {
  try {
    if (!PIPEBOARD_API_KEY) {
      return {
        success: false,
        message: 'Pipeboard API Key não configurada'
      };
    }

    console.log('Testando conexão com Pipeboard Google Ads MCP...');

    // Teste simples - tentar listar clientes
    const response = await googleAdsClient.post('/', {
      method: 'list_google_ads_customers'
    });

    console.log('✅ Conexão com Pipeboard Google Ads MCP bem-sucedida');

    return {
      success: true,
      message: 'Conectado ao Pipeboard Google Ads MCP',
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
 * Busca campanhas do Google Ads via Pipeboard MCP
 */
async function getCampaigns(customerId) {
  try {
    if (!customerId) {
      throw new Error('Customer ID é obrigatório');
    }

    console.log(`Buscando campanhas para customer: ${customerId}`);

    const response = await googleAdsClient.post('/', {
      method: 'get_google_ads_campaigns',
      params: {
        customer_id: customerId.toString()
      }
    });

    console.log(`✅ ${response.data.total_campaigns} campanhas encontradas`);
    return response.data.campaigns || [];
  } catch (error) {
    console.error('Erro ao buscar campanhas:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Busca métricas de performance do Google Ads via Pipeboard MCP
 */
async function getMetrics(customerId, dateRange = 'LAST_30_DAYS') {
  try {
    if (!customerId) {
      throw new Error('Customer ID é obrigatório');
    }

    console.log(`Buscando métricas para customer: ${customerId}, período: ${dateRange}`);

    const response = await googleAdsClient.post('/', {
      method: 'get_google_ads_campaign_metrics',
      params: {
        customer_id: customerId.toString(),
        date_range: dateRange,
        time_breakdown: 'day',
        status_filter: 'ENABLED'
      }
    });

    console.log(`✅ Métricas carregadas para ${response.data.returned_campaigns} campanhas`);
    return response.data.campaigns || [];
  } catch (error) {
    console.error('Erro ao buscar métricas:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Busca conversões/leads do Google Ads via Pipeboard MCP
 */
async function getConversions(customerId, dateRange = 'LAST_30_DAYS') {
  try {
    if (!customerId) {
      throw new Error('Customer ID é obrigatório');
    }

    console.log(`Buscando conversões para customer: ${customerId}`);

    const metrics = await getMetrics(customerId, dateRange);

    // Filtrar apenas campanhas com conversões
    const conversions = metrics
      .filter(campaign => campaign.conversions > 0)
      .map(campaign => ({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        conversions: campaign.conversions,
        conversion_value: campaign.conversion_value,
        cost: campaign.cost_micros / 1000000,
        impressions: campaign.impressions,
        clicks: campaign.clicks,
        cpc: campaign.average_cpc / 1000000
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
  getCampaigns,
  getMetrics,
  getConversions
};
