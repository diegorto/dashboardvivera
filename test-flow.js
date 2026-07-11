const axios = require('axios');
require('dotenv').config();

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_TOKEN;
const STAGE_RANK = {
  1: 0, 2: 1, 25: 1, 20: 1, 21: 1, 22: 1, 23: 1, 24: 1,
  3: 2, 4: 3, 13: 3, 5: 4, 6: 4, 7: 4
};

async function testFlow() {
  try {
    const dealsResponse = await axios.get(`https://api.pipedrive.com/v1/deals`, {
      params: { api_token: PIPEDRIVE_TOKEN, limit: 1, status: 'won' }
    });
    
    const deals = dealsResponse.data?.data || [];
    if (deals.length === 0) return console.log('Sem deals won');
    
    const dealId = deals[0].id;
    const flowResponse = await axios.get(`https://api.pipedrive.com/v1/deals/${dealId}/flow`, {
      params: { api_token: PIPEDRIVE_TOKEN, limit: 50 }
    });
    
    const events = flowResponse.data?.data || [];
    console.log(`Deal ${dealId} - ${events.length} eventos\n`);
    
    // Procura eventos de mudança de stage
    for (const e of events) {
      if (e.object === 'dealChange' && e.data && e.data.field_key === 'stage_id') {
        const newStageId = parseInt(e.data.new_value);
        const rank = STAGE_RANK[newStageId];
        const logTime = e.data.log_time || e.timestamp;
        console.log(`Stage ${newStageId} (rank ${rank}): log_time = ${logTime}`);
        
        if (rank !== undefined && rank >= 4) {
          console.log(`  ✓ COMPARECIMENTO encontrado em ${logTime}`);
          break;
        }
      }
    }
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

testFlow();
