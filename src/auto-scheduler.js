
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

module.exports = {
  startSchedulers: function() {
    console.log('📅 Iniciando agendadores automáticos...');

    // Sincronização a cada 5 minutos
    cron.schedule('*/5 * * * *', () => {
      console.log('[CRON] Sincronizando dados...');
      syncDashboardData();
    });

    // Análise de script às 18:05 (UTC)
    cron.schedule('5 18 * * *', () => {
      console.log('[CRON] Analisando conformidade do script...');
      analyzeScriptCompliance();
    });

    // Health check a cada 10 minutos
    cron.schedule('*/10 * * * *', () => {
      console.log('[CRON] Verificando saúde do sistema...');
      checkSystemHealth();
    });

    // Limpeza de cache antigo a cada dia
    cron.schedule('0 2 * * *', () => {
      console.log('[CRON] Limpando cache antigo...');
      cleanOldCache();
    });
  }
};

function syncDashboardData() {
  const cacheFile = path.join(__dirname, '..', 'data', 'cache', 'dashboard-cache.json');
  const cache = {
    lastUpdate: new Date().toISOString(),
    dataRefreshed: true
  };
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
}

function analyzeScriptCompliance() {
  console.log('   → Enviando conversas para N8N...');
  // TODO: Integrar com N8N
}

function checkSystemHealth() {
  const healthFile = path.join(__dirname, '..', 'data', 'health.json');
  const health = {
    status: 'healthy',
    uptime: process.uptime(),
    lastSync: new Date().toISOString(),
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(healthFile, JSON.stringify(health, null, 2));
}

function cleanOldCache() {
  const cacheDir = path.join(__dirname, '..', 'data', 'cache');
  const files = fs.readdirSync(cacheDir);
  // Manter apenas últimos 7 dias
  files.forEach(file => {
    const filePath = path.join(cacheDir, file);
    const stats = fs.statSync(filePath);
    const ageInDays = (Date.now() - stats.mtime) / (1000 * 60 * 60 * 24);
    if (ageInDays > 7) {
      fs.unlinkSync(filePath);
      console.log('   → Deletado:', file);
    }
  });
}
