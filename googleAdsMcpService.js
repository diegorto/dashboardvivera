const axios = require('axios');

/**
 * Conecta ao Pipeboard Google Ads via autenticação
 * Usa as credenciais do Google Ads para acessar a API
 */
async function testConnection(customerId, accessToken) {
  try {
    if (!customerId || !accessToken) {
      return {
        success: false,
        message: 'Customer ID e Access Token são obrigatórios'
      };
    }

    // Teste simples - tentar buscar uma campanha
    const response = await axios.get(
      'https://googleads.googleapis.com/v17/customers/' + customerId.replace('-', '') + '/googleAds:search',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Developer-Token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || ''
        },
        data: {
          query: 'SELECT campaign.id, campaign.name FROM campaign LIMIT 1'
        }
      }
    );

    return {
      success: true,
      message: 'Conectado ao Google Ads API',
      data: response.data
    };
  } catch (error) {
    console.error('Erro ao testar conexão:', error.message);
    return {
      success: false,
      message: `Erro ao conectar: ${error.message}`
    };
  }
}

/**
 * Busca campanhas do Google Ads
 */
async function getCampaigns(customerId, accessToken) {
  try {
    const response = await axios.post(
      `https://googleads.googleapis.com/v17/customers/${customerId.replace('-', '')}/googleAds:search`,
      {
        query: `SELECT campaign.id, campaign.name, campaign.status FROM campaign ORDER BY campaign.id DESC LIMIT 100`
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Developer-Token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || ''
        }
      }
    );

    return response.data.results?.map(result => result.campaign) || [];
  } catch (error) {
    console.error('Erro ao buscar campanhas:', error.message);
    throw error;
  }
}

/**
 * Busca métricas de performance do Google Ads
 */
async function getMetrics(customerId, accessToken, dateRange) {
  try {
    const response = await axios.post(
      `https://googleads.googleapis.com/v17/customers/${customerId.replace('-', '')}/googleAds:search`,
      {
        query: `
          SELECT
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversion_value
          FROM campaign
          WHERE segments.date BETWEEN '${dateRange.since}' AND '${dateRange.until}'
          ORDER BY campaign.name
        `
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Developer-Token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || ''
        }
      }
    );

    return response.data.results || [];
  } catch (error) {
    console.error('Erro ao buscar métricas:', error.message);
    throw error;
  }
}

/**
 * Busca conversões/leads do Google Ads
 */
async function getConversions(customerId, accessToken, dateRange) {
  try {
    const response = await axios.post(
      `https://googleads.googleapis.com/v17/customers/${customerId.replace('-', '')}/googleAds:search`,
      {
        query: `
          SELECT
            campaign.name,
            metrics.conversions,
            metrics.conversion_value,
            segments.date
          FROM campaign
          WHERE segments.date BETWEEN '${dateRange.since}' AND '${dateRange.until}'
          AND metrics.conversions > 0
          ORDER BY segments.date DESC
        `
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Developer-Token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || ''
        }
      }
    );

    return response.data.results || [];
  } catch (error) {
    console.error('Erro ao buscar conversões:', error.message);
    throw error;
  }
}

module.exports = {
  testConnection,
  getCampaigns,
  getMetrics,
  getConversions
};
