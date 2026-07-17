const axios = require('axios');

// Configuração da integração Pipeboard Google Ads
const PIPEBOARD_GOOGLE_ADS_TOKEN = process.env.PIPEBOARD_GOOGLE_ADS_TOKEN || '';
const PIPEBOARD_GOOGLE_ADS_BASE_URL = 'https://google-ads.mcp.pipeboard.co';
const GOOGLE_ADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID || '';

// Cliente Axios para chamar Pipeboard Google Ads API
const pipeboardGoogleAdsClient = axios.create({
  baseURL: PIPEBOARD_GOOGLE_ADS_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Testa conexão com Pipeboard Google Ads
 */
async function testConnection() {
  try {
    if (!PIPEBOARD_GOOGLE_ADS_TOKEN) {
      return {
        success: false,
        message: 'Pipeboard Google Ads Token não configurado'
      };
    }

    console.log('Testando conexão com Pipeboard Google Ads...');

    // Tenta buscar clientes disponíveis
    const response = await pipeboardGoogleAdsClient.get('/', {
      params: { token: PIPEBOARD_GOOGLE_ADS_TOKEN }
    });

    console.log('✅ Conexão com Pipeboard Google Ads bem-sucedida');
    return {
      success: true,
      message: 'Conectado ao Pipeboard Google Ads',
      data: response.data
    };
  } catch (error) {
    console.error('❌ Erro ao testar conexão:', error.response?.data || error.message);
    return {
      success: false,
      message: `Erro ao conectar: ${error.message}`
    };
  }
}

/**
 * Lista clientes disponíveis no Google Ads via Pipeboard
 */
async function listCustomers() {
  try {
    if (!PIPEBOARD_GOOGLE_ADS_TOKEN) {
      throw new Error('PIPEBOARD_GOOGLE_ADS_TOKEN não configurado');
    }

    console.log('Listando clientes Google Ads disponíveis via Pipeboard...');

    const response = await pipeboardGoogleAdsClient.get('/', {
      params: {
        token: PIPEBOARD_GOOGLE_ADS_TOKEN,
        method: 'list_google_ads_customers'
      }
    });

    const customers = response.data.customers || response.data.data || [];
    console.log(`✅ ${customers.length} clientes encontrados`);
    return customers;
  } catch (error) {
    console.error('Erro ao listar clientes:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Busca campanhas do Google Ads via Pipeboard
 */
async function getCampaigns(customerId) {
  try {
    if (!customerId) {
      throw new Error('Customer ID é obrigatório');
    }
    if (!PIPEBOARD_GOOGLE_ADS_TOKEN) {
      throw new Error('PIPEBOARD_GOOGLE_ADS_TOKEN não configurado');
    }

    console.log(`Buscando campanhas para customer: ${customerId}`);

    const response = await pipeboardGoogleAdsClient.get('/', {
      params: {
        token: PIPEBOARD_GOOGLE_ADS_TOKEN,
        method: 'get_google_ads_campaigns',
        customer_id: customerId.toString()
      }
    });

    const campaigns = response.data.campaigns || response.data.data || [];
    console.log(`✅ ${campaigns.length} campanhas encontradas`);
    return campaigns;
  } catch (error) {
    console.error('Erro ao buscar campanhas:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Busca métricas de performance do Google Ads via Pipeboard
 */
async function getMetrics(customerId, dateRange = 'LAST_30_DAYS') {
  try {
    if (!customerId) {
      throw new Error('Customer ID é obrigatório');
    }
    if (!PIPEBOARD_GOOGLE_ADS_TOKEN) {
      throw new Error('PIPEBOARD_GOOGLE_ADS_TOKEN não configurado');
    }

    console.log(`Buscando métricas para customer: ${customerId}, período: ${dateRange}`);

    const response = await pipeboardGoogleAdsClient.get('/', {
      params: {
        token: PIPEBOARD_GOOGLE_ADS_TOKEN,
        method: 'get_google_ads_campaign_metrics',
        customer_id: customerId.toString(),
        date_range: dateRange,
        time_breakdown: 'day'
      }
    });

    const metrics = response.data.metrics || response.data.campaigns || [];
    console.log(`✅ Métricas carregadas para ${metrics.length} campanhas`);
    return metrics;
  } catch (error) {
    console.error('Erro ao buscar métricas:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Busca conversões/leads do Google Ads via Pipeboard
 */
async function getConversions(customerId, dateRange = 'LAST_30_DAYS') {
  try {
    if (!customerId) {
      throw new Error('Customer ID é obrigatório');
    }
    if (!PIPEBOARD_GOOGLE_ADS_TOKEN) {
      throw new Error('PIPEBOARD_GOOGLE_ADS_TOKEN não configurado');
    }

    console.log(`Buscando conversões para customer: ${customerId}, período: ${dateRange}`);

    const response = await pipeboardGoogleAdsClient.get('/', {
      params: {
        token: PIPEBOARD_GOOGLE_ADS_TOKEN,
        method: 'get_google_ads_conversions',
        customer_id: customerId.toString(),
        date_range: dateRange
      }
    });

    const conversions = response.data.conversions || response.data.data || [];
    console.log(`✅ ${conversions.length} conversões encontradas`);
    return conversions;
  } catch (error) {
    console.error('Erro ao buscar conversões:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  testConnection,
  listCustomers,
  getCampaigns,
  getMetrics,
  getConversions
};
