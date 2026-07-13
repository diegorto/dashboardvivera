require('dotenv').config();
const axios = require('axios');

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_TOKEN;
const BASE_URL = 'https://api.pipedrive.com/v1';

async function discoverSources() {
  console.log('\n🔍 Descobrindo fontes de leads no Pipedrive...\n');

  try {
    // 1. Buscar todos os Labels (etiquetas)
    console.log('📌 Buscando Labels (etiquetas)...');
    const labelsRes = await axios.get(`${BASE_URL}/labels`, {
      params: { api_token: PIPEDRIVE_TOKEN }
    });

    if (labelsRes.data.success && labelsRes.data.data) {
      console.log('Labels encontrados:');
      labelsRes.data.data.forEach(label => {
        if ([88, 87, 'Não rastreado', 'Sem fonte'].includes(label.id) || label.name.includes('88') || label.name.includes('87')) {
          console.log(`  ID: ${label.id} - Nome: ${label.name}`);
        }
      });
    }

    // 2. Buscar campos customizados do Deal
    console.log('\n📝 Buscando campos customizados de Deal...');
    const fieldsRes = await axios.get(`${BASE_URL}/dealFields`, {
      params: { api_token: PIPEDRIVE_TOKEN }
    });

    if (fieldsRes.data.success && fieldsRes.data.data) {
      const originField = fieldsRes.data.data.find(f =>
        f.key.toLowerCase().includes('origin') ||
        f.name.toLowerCase().includes('origem') ||
        f.name.toLowerCase().includes('fonte')
      );

      if (originField) {
        console.log(`\nCampo de Origem encontrado: ${originField.name}`);
        console.log(`  Key: ${originField.key}`);
        console.log(`  Tipo: ${originField.field_type}`);

        if (originField.options) {
          console.log('  Opções disponíveis:');
          originField.options.forEach(opt => {
            console.log(`    ID: ${opt.id} - ${opt.label}`);
          });
        }
      }
    }

    // 3. Buscar alguns deals para ver as origens reais
    console.log('\n🎯 Analisando deals para entender as origens...');
    const dealsRes = await axios.get(`${BASE_URL}/deals`, {
      params: {
        api_token: PIPEDRIVE_TOKEN,
        limit: 50,
        sort: 'add_time DESC'
      }
    });

    if (dealsRes.data.success && dealsRes.data.data) {
      const sourceMap = {};

      dealsRes.data.data.forEach(deal => {
        // Procurar por campos que possam indicar a origem
        Object.keys(deal).forEach(key => {
          if (key.toLowerCase().includes('origin') ||
              key.toLowerCase().includes('source') ||
              key.toLowerCase().includes('fonte')) {
            const value = deal[key];
            if (value) {
              sourceMap[value] = (sourceMap[value] || 0) + 1;
            }
          }
        });
      });

      if (Object.keys(sourceMap).length > 0) {
        console.log('Origens encontradas nos deals:');
        Object.entries(sourceMap).forEach(([source, count]) => {
          console.log(`  ${source}: ${count} deals`);
        });
      }
    }

    // 4. Buscar estágios do pipeline Inbound
    console.log('\n🔄 Buscando estágios do pipeline Inbound...');
    const pipelinesRes = await axios.get(`${BASE_URL}/pipelines`, {
      params: { api_token: PIPEDRIVE_TOKEN }
    });

    if (pipelinesRes.data.success && pipelinesRes.data.data) {
      const inboundPipeline = pipelinesRes.data.data.find(p =>
        p.name.toLowerCase().includes('inbound')
      );

      if (inboundPipeline) {
        const stagesRes = await axios.get(`${BASE_URL}/pipelines/${inboundPipeline.id}/stages`, {
          params: { api_token: PIPEDRIVE_TOKEN }
        });

        if (stagesRes.data.success && stagesRes.data.data) {
          console.log(`Estágios do pipeline "${inboundPipeline.name}":`);
          stagesRes.data.data.forEach(stage => {
            console.log(`  ID: ${stage.id} - ${stage.name}`);
          });
        }
      }
    }

    console.log('\n✅ Descoberta concluída!\n');

  } catch (error) {
    console.error('\n❌ Erro ao consultar API do Pipedrive:');
    console.error(error.response?.data || error.message);
  }
}

discoverSources();
