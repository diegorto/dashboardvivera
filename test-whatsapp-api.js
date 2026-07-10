#!/usr/bin/env node
// Script de teste dos endpoints WhatsApp Analytics

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const ENDPOINTS = [
  { path: '/api/whatsapp/stats', desc: 'KPIs Básicos' },
  { path: '/api/whatsapp/calls', desc: 'Lista de Chamadas' },
  { path: '/api/whatsapp/lead-timing?type=messages', desc: 'Tempo até 1ª Mensagem' },
  { path: '/api/whatsapp/lead-timing?type=calls', desc: 'Tempo até 1ª Ligação' },
  { path: '/api/whatsapp/patterns', desc: 'Padrões & Insights' },
  { path: '/api/whatsapp/message-types', desc: 'Efetividade de Mensagens' },
];

async function testEndpoints() {
  console.log(`\n🧪 Testando endpoints WhatsApp Analytics`);
  console.log(`📍 Base URL: ${BASE_URL}\n`);

  for (const { path, desc } of ENDPOINTS) {
    try {
      console.log(`⏳ Testando: ${desc}`);
      console.log(`   GET ${path}`);

      const response = await axios.get(`${BASE_URL}${path}`);
      const dataSize = JSON.stringify(response.data).length;

      console.log(`   ✅ Sucesso! ${dataSize} bytes`);
      console.log(`   Exemplo: ${JSON.stringify(response.data).substring(0, 100)}...`);
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
    console.log();
  }
}

testEndpoints();
