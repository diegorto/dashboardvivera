#!/usr/bin/env node
require('dotenv').config();
const axios = require('axios');

console.log('\n🔍 Validando credenciais do Vivera Dashboard\n');

const checks = [];

// Check Pipedrive
(async () => {
  try {
    const res = await axios.get('https://api.pipedrive.com/v1/users/me', {
      params: { api_token: process.env.PIPEDRIVE_TOKEN }
    });
    checks.push({ name: 'Pipedrive', status: '✅', msg: `Conectado como ${res.data.data.name}` });
  } catch (e) {
    checks.push({ name: 'Pipedrive', status: '❌', msg: e.response?.data?.error || e.message });
  }

  // Check Facebook
  try {
    const res = await axios.get('https://graph.facebook.com/v18.0/me', {
      params: { access_token: process.env.FB_ACCESS_TOKEN }
    });
    checks.push({ name: 'Facebook', status: '✅', msg: `Conectado como ${res.data.name}` });
  } catch (e) {
    checks.push({ name: 'Facebook', status: '❌', msg: e.response?.data?.error?.message || e.message });
  }

  // Print results
  console.log('Resultados:');
  checks.forEach(c => console.log(`${c.status} ${c.name}: ${c.msg}`));
  console.log('');
})();
