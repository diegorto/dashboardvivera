const axios = require('axios');

// Configuração direta da API REST Pipeboard para Google Ads
const PIPEBOARD_API_KEY = process.env.PIPEBOARD_API_KEY || '';
const PIPEBOARD_BASE_URL = process.env.PIPEBOARD_BASE_URL || 'https://api.pipeboard.co';
const GOOGLE_ADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID || '';

// Cliente Axios para chamar Pipeboard REST API
const pipeboardClient = axios.create({
  baseURL: PIPEBOARD_BASE_URL,
  timeout: 30000,
  headers: {
    'Authorization': `Bearer ${PIPEBOARD_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Testa conexão com Pipeboard Google Ads API
 */
async function testConnection() {
  try {
    if (!PIPEBOARD_API_KEY) {
      return {
        success: false,
        message: 'Pipeboard API Key não configurada'
      };
    }

    console.log('Testando conexão com Pipeboard Google Ads...');

    // Tenta buscar clientes disponíveis
    const response = await pipeboardClient.get('/google-ads/customers');

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
    console.log('Listando clientes Google Ads disponíveis...');

    const response = await pipeboardClient.get('/google-ads/customers');

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

    console.log(`Buscando campanhas para customer: ${customerId}`);

    const response = await pipeboardClient.get(`/google-ads/customers/${customerId}/campaigns`);

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

    console.log(`Buscando métricas para customer: ${customerId}, período: ${dateRange}`);

    const response = await pipeboardClient.get(`/google-ads/customers/${customerId}/metrics`, {
      params: {
        date_range: dateRange,
        time_breakdown: 'day',
        status_filter: 'ENABLED'
      }
    });

    const metrics = response.data.metrics || response.data.data || [];
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

    console.log(`Buscando conversões para customer: ${customerId}, período: ${dateRange}`);

    const response = await pipeboardClient.get(`/google-ads/customers/${customerId}/conversions`, {
      params: {
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
