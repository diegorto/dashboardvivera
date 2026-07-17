const axios = require('axios');

const PIPEBOARD_API_KEY = process.env.PIPEBOARD_API_KEY || '';
const PIPEBOARD_GOOGLE_ADS_BASE_URL = 'https://google-ads.mcp.pipeboard.co';
const GOOGLE_ADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID || '';

const pipeboardGoogleAdsClient = axios.create({
  baseURL: PIPEBOARD_GOOGLE_ADS_BASE_URL,
  timeout: 30000,
  headers: {
    'Authorization': `Bearer ${PIPEBOARD_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

let _rpcId = 0;

async function callTool(toolName, args = {}) {
  const id = ++_rpcId;
  const response = await pipeboardGoogleAdsClient.post('/', {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    }
  });

  const data = response.data;

  if (data && data.error) {
    throw new Error(data.error.message || 'Erro desconhecido no MCP do Google Ads');
  }

  const content = data && data.result && data.result.content;
  if (!Array.isArray(content) || content.length === 0) {
    return data && data.result;
  }

  const textBlock = content.find(c => c.type === 'text');
  if (!textBlock) {
    return data.result;
  }

  try {
    return JSON.parse(textBlock.text);
  } catch (e) {
    return textBlock.text;
  }
}

async function testConnection() {
  try {
    await callTool('list_google_ads_customers', {});
    return true;
  } catch (e) {
    return false;
  }
}

async function listCustomers() {
  const result = await callTool('list_google_ads_customers', {});
  return (result && (result.customers || result.data)) || [];
}

async function getCampaigns(customerId) {
  const result = await callTool('get_google_ads_campaigns', {
    customer_id: customerId
  });
  return (result && (result.campaigns || result.data)) || [];
}

async function getMetrics(customerId, dateRange = 'LAST_30_DAYS') {
  const result = await callTool('get_google_ads_campaign_metrics', {
    customer_id: customerId,
    date_range: dateRange,
    status_filter: 'ALL'
  });
  return (result && (result.campaigns || result.data || result.metrics)) || [];
}

async function getConversions(customerId, dateRange = 'LAST_30_DAYS') {
  const result = await callTool('get_google_ads_campaign_metrics', {
    customer_id: customerId,
    date_range: dateRange,
    status_filter: 'ALL'
  });
  const campaigns = (result && (result.campaigns || result.data)) || [];
  return campaigns
    .filter(c => (c.conversions || 0) > 0)
    .map(c => ({
      campaign_id: c.campaign_id,
      campaign_name: c.campaign_name,
      conversions: c.conversions,
      conversions_value: c.conversions_value
    }));
}

module.exports = {
  testConnection,
  listCustomers,
  getCampaigns,
  getMetrics,
  getConversions
};
