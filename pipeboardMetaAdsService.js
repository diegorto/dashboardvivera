const axios = require('axios');

// Configuração direta da API REST Pipeboard para Meta Ads
const PIPEBOARD_API_KEY = process.env.PIPEBOARD_API_KEY || '';
const PIPEBOARD_BASE_URL = process.env.PIPEBOARD_BASE_URL || 'https://api.pipeboard.co';
const META_AD_ACCOUNT_IDS = (process.env.META_AD_ACCOUNT_IDS || '').split(',').filter(Boolean);

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
 * Testa conexão com Pipeboard Meta Ads API
 */
async function testConnection() {
  try {
    if (!PIPEBOARD_API_KEY) {
      return {
        success: false,
        message: 'Pipeboard API Key não configurada'
      };
    }

    console.log('Testando conexão com Pipeboard Meta Ads...');

    // Tenta buscar contas disponíveis
    const response = await pipeboardClient.get('/meta-ads/accounts');

    console.log('✅ Conexão com Pipeboard Meta Ads bem-sucedida');
    return {
      success: true,
      message: 'Conectado ao Pipeboard Meta Ads',
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
 * Lista contas disponíveis no Meta Ads via Pipeboard
 */
async function getAccounts() {
  try {
    console.log('Listando contas Meta Ads disponíveis...');

    const response = await pipeboardClient.get('/meta-ads/accounts');

    const accounts = response.data.accounts || response.data.data || [];
    console.log(`✅ ${accounts.length} contas encontradas`);
    return accounts;
  } catch (error) {
    console.error('Erro ao listar contas:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Busca campanhas do Meta Ads via Pipeboard
 */
async function getCampaigns(accountId) {
  try {
    if (!accountId) {
      throw new Error('Account ID é obrigatório');
    }

    console.log(`Buscando campanhas para account: ${accountId}`);

    const response = await pipeboardClient.get(`/meta-ads/accounts/${accountId}/campaigns`);

    const campaigns = response.data.campaigns || response.data.data || [];
    console.log(`✅ ${campaigns.length} campanhas encontradas`);
    return campaigns;
  } catch (error) {
    console.error('Erro ao buscar campanhas:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Busca métricas de performance do Meta Ads via Pipeboard
 */
async function getMetrics(accountId, dateRange = 'LAST_30_DAYS') {
  try {
    if (!accountId) {
      throw new Error('Account ID é obrigatório');
    }

    console.log(`Buscando métricas para account: ${accountId}, período: ${dateRange}`);

    const response = await pipeboardClient.get(`/meta-ads/accounts/${accountId}/metrics`, {
      params: {
        date_range: dateRange,
        breakdown: 'campaign',
        status_filter: 'ACTIVE'
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
 * Busca conversões/leads do Meta Ads via Pipeboard
 */
async function getConversions(accountId, dateRange = 'LAST_30_DAYS') {
  try {
    if (!accountId) {
      throw new Error('Account ID é obrigatório');
    }

    console.log(`Buscando conversões para account: ${accountId}, período: ${dateRange}`);

    const response = await pipeboardClient.get(`/meta-ads/accounts/${accountId}/conversions`, {
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
  getAccounts,
  getCampaigns,
  getMetrics,
  getConversions
};
