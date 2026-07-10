
// Auto-atualização do dashboard a cada 30 segundos
class DashboardAutoUpdater {
  constructor(intervalSeconds = 30) {
    this.interval = intervalSeconds * 1000;
    this.updateTimer = null;
  }

  start() {
    console.log('🔄 Iniciando auto-atualização do dashboard...');
    this.updateTimer = setInterval(() => {
      this.refreshDashboard();
    }, this.interval);
  }

  stop() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      console.log('⏹️ Auto-atualização parada');
    }
  }

  async refreshDashboard() {
    try {
      // Verificar se há novo cache disponível
      const response = await fetch('/api/whatsapp/stats');
      const data = await response.json();

      // Atualizar valores no DOM
      document.getElementById('totalCalls').textContent = data.total_calls || '-';
      document.getElementById('answeredCalls').textContent = data.answered_calls || '-';
      document.getElementById('answerRate').textContent = (data.answer_rate || 0).toFixed(1) + '%';
      document.getElementById('avgDuration').textContent = Math.round(data.avg_duration || 0);

      console.log('✅ Dashboard atualizado:', new Date().toLocaleTimeString());
    } catch (error) {
      console.error('❌ Erro ao atualizar dashboard:', error);
    }
  }
}

// Iniciar automático se documento estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const updater = new DashboardAutoUpdater(30);
    updater.start();
  });
} else {
  const updater = new DashboardAutoUpdater(30);
  updater.start();
}
