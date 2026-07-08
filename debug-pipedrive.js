// Script de diagnostico #2: descobre os campos "Trafego Pago" (Campanha, Conjunto
// de anuncio, etc.) que vivem no DEAL (negocio), e lista os pipelines existentes.
//
// Como rodar:
//   1. Copie este arquivo para dentro da pasta audit-server (mesmo lugar do .env)
//   2. No terminal, dentro da pasta audit-server, rode: node debug-pipedrive-2.js
//   3. Me cole a saida completa

require('dotenv').config();
const axios = require('axios');

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_TOKEN;

async function main() {
  if (!PIPEDRIVE_TOKEN) {
    console.log('ERRO: PIPEDRIVE_TOKEN nao encontrado. Rode este script de dentro da pasta audit-server (onde esta o .env).');
    return;
  }

  console.log('========== PIPELINES ==========');
  try {
    const pipelinesRes = await axios.get('https://api.pipedrive.com/v1/pipelines', {
      params: { api_token: PIPEDRIVE_TOKEN }
    });
    (pipelinesRes.data.data || []).forEach(p => {
      console.log(`- id: ${p.id}  |  nome: ${p.name}`);
    });
  } catch (e) {
    console.log('ERRO ao buscar pipelines:', e.response?.status, JSON.stringify(e.response?.data || e.message));
  }

  console.log('\n========== CAMPOS DE DEAL (definicao completa) ==========');
  let dealFieldMap = {};
  try {
    const fieldsRes = await axios.get('https://api.pipedrive.com/v1/dealFields', {
      params: { api_token: PIPEDRIVE_TOKEN }
    });
    (fieldsRes.data.data || []).forEach(f => {
      dealFieldMap[f.key] = f.name;
      console.log(`- name: "${f.name}"  |  key: ${f.key}  |  field_type: ${f.field_type}`);
    });
  } catch (e) {
    console.log('ERRO ao buscar dealFields:', e.response?.status, JSON.stringify(e.response?.data || e.message));
  }

  console.log('\n========== AMOSTRA DE 5 DEALS (todos os status, com nomes dos campos) ==========');
  try {
    const dealsRes = await axios.get('https://api.pipedrive.com/v1/deals', {
      params: { api_token: PIPEDRIVE_TOKEN, limit: 5, status: 'all_not_deleted' }
    });
    const deals = dealsRes.data.data || [];
    console.log(`Total nesta pagina: ${deals.length}`);
    deals.forEach((d, i) => {
      console.log(`\n--- Deal ${i + 1} (id: ${d.id}, titulo: ${d.title}, status: ${d.status}, pipeline_id: ${d.pipeline_id}) ---`);
      Object.keys(d).forEach(key => {
        const value = d[key];
        if (value === null || value === '' || value === undefined) return;
        if (typeof value === 'object') return; // pula objetos aninhados (person_id, org_id, etc)
        const friendlyName = dealFieldMap[key] || key;
        console.log(`   [${friendlyName}] (${key}): ${value}`);
      });
    });
  } catch (e) {
    console.log('ERRO ao buscar deals:', e.response?.status, JSON.stringify(e.response?.data || e.message));
  }
}

main();
