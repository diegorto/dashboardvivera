// Estado global
let dashboardState = {
  data: null,
  currentPage: 1,
  itemsPerPage: 20,
  filteredCalls: [],
  charts: {}
};

// Elementos do DOM
const elements = {
  loadingSpinner: document.getElementById('loadingSpinner'),
  errorMessage: document.getElementById('errorMessage'),
  dateRange: document.getElementById('dateRange'),
  refreshBtn: document.getElementById('refreshBtn'),
  statusFilter: document.getElementById('statusFilter'),
  prevPageBtn: document.getElementById('prevPageBtn'),
  nextPageBtn: document.getElementById('nextPageBtn'),
  pageInfo: document.getElementById('pageInfo')
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  elements.refreshBtn.addEventListener('click', loadDashboard);
  elements.dateRange.addEventListener('change', loadDashboard);
  elements.statusFilter.addEventListener('change', updateCallsTable);
  elements.prevPageBtn.addEventListener('click', previousPage);
  elements.nextPageBtn.addEventListener('click', nextPage);

  loadDashboard();
});

// Carregar dados do dashboard
async function loadDashboard() {
  showLoading(true);
  clearError();

  try {
    const dateRange = elements.dateRange.value;
    const params = new URLSearchParams({ range: dateRange });

    // Buscar todos os endpoints
    const [stats, calls, timing, patterns, messages] = await Promise.all([
      fetch(`/api/whatsapp/stats?${params}`).then(r => r.json()),
      fetch(`/api/whatsapp/calls?${params}`).then(r => r.json()),
      fetch(`/api/whatsapp/lead-timing?${params}`).then(r => r.json()),
      fetch(`/api/whatsapp/patterns?${params}`).then(r => r.json()),
      fetch(`/api/whatsapp/message-types?${params}`).then(r => r.json())
    ]);

    dashboardState.data = {
      stats,
      calls,
      timing,
      patterns,
      messages
    };

    renderDashboard();
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    showError('Erro ao carregar dados. Verifique a conexão e tente novamente.');
  } finally {
    showLoading(false);
  }
}

// Renderizar dashboard
function renderDashboard() {
  const { data } = dashboardState;

  renderKPIs(data.stats);
  renderCharts(data.timing);
  renderHourlyChart(data.patterns);
  renderImpactCard(data.patterns);
  renderMessageTypesTable(data.messages);
  renderCallsTable(data.calls);
  renderScriptCompliance();
  renderInsights(data);
}

// KPIs
function renderKPIs(stats) {
  document.getElementById('totalCalls').textContent = stats.total_calls || '-';
  document.getElementById('answeredCalls').textContent = stats.answered_calls || '-';
  document.getElementById('answerRate').textContent = `${(stats.answer_rate || 0).toFixed(1)}%`;
  document.getElementById('avgDuration').textContent = Math.round(stats.avg_duration || 0);
}

// Gráficos de Timing
function renderCharts(timing) {
  renderFirstMessageChart(timing.message_timing);
  renderFirstCallChart(timing.call_timing);
}

function renderFirstMessageChart(data) {
  const ctx = document.getElementById('firstMessageChart');

  if (dashboardState.charts.firstMessage) {
    dashboardState.charts.firstMessage.destroy();
  }

  const labels = data.distribution.map(d => d.label);
  const values = data.distribution.map(d => d.count);

  dashboardState.charts.firstMessage = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Conversas',
        data: values,
        backgroundColor: '#3b82f6',
        borderColor: '#1e40af',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return Math.floor(value);
            }
          }
        }
      }
    }
  });

  document.getElementById('msgAvg').textContent = data.average.toFixed(1);
  document.getElementById('msgMedian').textContent = data.median.toFixed(1);
  document.getElementById('msgP95').textContent = data.p95.toFixed(1);
}

function renderFirstCallChart(data) {
  const ctx = document.getElementById('firstCallChart');

  if (dashboardState.charts.firstCall) {
    dashboardState.charts.firstCall.destroy();
  }

  const labels = data.distribution.map(d => d.label);
  const values = data.distribution.map(d => d.count);

  dashboardState.charts.firstCall = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Conversas',
        data: values,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });

  document.getElementById('callAvg').textContent = data.average.toFixed(1);
  document.getElementById('callMedian').textContent = data.median.toFixed(1);
  document.getElementById('callP95').textContent = data.p95.toFixed(1);
}

// Gráfico de taxa por hora
function renderHourlyChart(patterns) {
  const ctx = document.getElementById('hourlyChart');

  if (dashboardState.charts.hourly) {
    dashboardState.charts.hourly.destroy();
  }

  const hourlyData = patterns.hourly_patterns || [];
  const labels = hourlyData.map(h => `${h.hour}h`);
  const rates = hourlyData.map(h => h.rate);

  // Encontrar melhor hora
  const bestHour = hourlyData.reduce((best, current) =>
    current.rate > best.rate ? current : best, hourlyData[0] || {});

  dashboardState.charts.hourly = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Taxa de Atendimento (%)',
        data: rates,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#f59e0b',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    }
  });

  if (bestHour.hour) {
    document.getElementById('bestHourInsight').textContent =
      `📊 Melhor horário: ${bestHour.hour}h com ${bestHour.rate.toFixed(1)}% de atendimento`;
  }
}

// Card de impacto
function renderImpactCard(patterns) {
  const impact = patterns.message_previa_impact || {};

  document.getElementById('withMsgRate').textContent = `${(impact.with_message_rate || 0).toFixed(1)}%`;
  document.getElementById('withMsgCount').textContent = `${impact.with_message_count || 0} tentativas`;

  document.getElementById('withoutMsgRate').textContent = `${(impact.without_message_rate || 0).toFixed(1)}%`;
  document.getElementById('withoutMsgCount').textContent = `${impact.without_message_count || 0} tentativas`;

  const impactValue = ((impact.with_message_rate || 0) - (impact.without_message_rate || 0)).toFixed(1);
  document.getElementById('impactValue').textContent = `+${impactValue}%`;
}

// Tabela de tipos de mensagem
function renderMessageTypesTable(messages) {
  const tbody = document.getElementById('messageTypesBody');

  if (!messages || !messages.types || messages.types.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">Sem dados</td></tr>';
    return;
  }

  tbody.innerHTML = messages.types.map(msg => `
    <tr>
      <td><strong>${msg.type}</strong></td>
      <td>${msg.sent}</td>
      <td>${msg.responses}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="background: #e5e7eb; width: 60px; height: 6px; border-radius: 3px;">
            <div style="background: #3b82f6; width: ${msg.response_rate}%; height: 100%; border-radius: 3px;"></div>
          </div>
          ${msg.response_rate.toFixed(1)}%
        </div>
      </td>
      <td>${msg.avg_response_time.toFixed(1)}h</td>
    </tr>
  `).join('');
}

// Tabela de chamadas recentes
function renderCallsTable(calls) {
  const statusFilter = elements.statusFilter.value;

  // Filtrar chamadas
  dashboardState.filteredCalls = calls.filter(call =>
    statusFilter === 'all' || call.status === statusFilter
  );

  dashboardState.currentPage = 1;
  updateCallsTable();
}

function updateCallsTable() {
  const tbody = document.getElementById('recentCallsBody');
  const { filteredCalls, currentPage, itemsPerPage } = dashboardState;

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginatedCalls = filteredCalls.slice(start, end);

  if (paginatedCalls.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="no-data">Nenhuma chamada</td></tr>';
    updatePagination();
    return;
  }

  tbody.innerHTML = paginatedCalls.map(call => {
    const statusBadge = call.status === 'completed'
      ? `<span class="status-badge status-completed">✅ Atendida</span>`
      : `<span class="status-badge status-missed">❌ Não atendida</span>`;

    const duration = call.status === 'completed'
      ? formatDuration(call.duration)
      : '-';

    return `
      <tr>
        <td>${call.client_name || 'Desconhecido'}</td>
        <td>${call.phone_number}</td>
        <td>${new Date(call.timestamp).toLocaleString('pt-BR')}</td>
        <td>${duration}</td>
        <td>${call.sdr_name || '-'}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');

  updatePagination();
}

function updatePagination() {
  const { filteredCalls, currentPage, itemsPerPage } = dashboardState;
  const totalPages = Math.ceil(filteredCalls.length / itemsPerPage);

  document.getElementById('pageInfo').textContent = `Página ${currentPage} de ${totalPages}`;
  elements.prevPageBtn.disabled = currentPage === 1;
  elements.nextPageBtn.disabled = currentPage === totalPages;
}

function previousPage() {
  if (dashboardState.currentPage > 1) {
    dashboardState.currentPage--;
    updateCallsTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function nextPage() {
  const totalPages = Math.ceil(
    dashboardState.filteredCalls.length / dashboardState.itemsPerPage
  );
  if (dashboardState.currentPage < totalPages) {
    dashboardState.currentPage++;
    updateCallsTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Script Compliance (N8N Inspector)
async function renderScriptCompliance() {
  try {
    const response = await fetch(`/api/whatsapp/script-compliance`);
    const compliance = await response.json();

    // Render compliance gauge
    document.getElementById('complianceValue').textContent = Math.round(compliance.daily_compliance);
    const status = compliance.daily_compliance >= 80 ? '✅ Excelente' :
                   compliance.daily_compliance >= 70 ? '⚠️ Bom' :
                   compliance.daily_compliance >= 50 ? '⚠️ Aceitável' :
                   '❌ Crítico';
    document.getElementById('complianceStatus').textContent = status;

    // Render compliance trend chart
    renderComplianceTrendChart(compliance.compliance_trend);

    // Render SDR compliance
    renderSDRCompliance(compliance.by_sdr);

    // Render issues
    renderIssues(compliance.issues);
  } catch (error) {
    console.error('Erro ao carregar script compliance:', error);
  }
}

function renderComplianceTrendChart(trend) {
  const ctx = document.getElementById('complianceTrendChart');

  if (dashboardState.charts.complianceTrend) {
    dashboardState.charts.complianceTrend.destroy();
  }

  const labels = trend.map(t => new Date(t.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }));
  const rates = trend.map(t => t.rate);

  dashboardState.charts.complianceTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Taxa de Conformidade (%)',
        data: rates,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    }
  });
}

function renderSDRCompliance(sdrs) {
  const container = document.getElementById('sdrComplianceList');

  if (!sdrs || sdrs.length === 0) {
    container.innerHTML = '<p>Sem dados</p>';
    return;
  }

  container.innerHTML = sdrs.map(sdr => {
    const complianceColor = sdr.compliance >= 80 ? '#10b981' :
                           sdr.compliance >= 70 ? '#f59e0b' :
                           '#ef4444';
    return `
      <div class="sdr-compliance-item">
        <div class="sdr-compliance-item-info">
          <div class="sdr-name">👤 ${sdr.sdr}</div>
          <div class="sdr-convs">${sdr.conversations} conversas analisadas</div>
        </div>
        <div class="sdr-compliance-item-bar">
          <div class="compliance-bar">
            <div class="compliance-fill" style="width: ${sdr.compliance}%; background: ${complianceColor};"></div>
          </div>
        </div>
        <div class="sdr-compliance-item-value" style="color: ${complianceColor};">
          ${sdr.compliance.toFixed(1)}%
        </div>
      </div>
    `;
  }).join('');
}

function renderIssues(issues) {
  const container = document.getElementById('issuesList');

  if (!issues || issues.length === 0) {
    container.innerHTML = '<p>✅ Nenhum problema detectado!</p>';
    return;
  }

  const issueIcons = {
    missing_greeting: '👋',
    skipped_qualification: '❓',
    rushed_closing: '⚡',
    wrong_sequence: '🔀',
    incomplete_info: '📝'
  };

  container.innerHTML = issues.map(issue => {
    const icon = issueIcons[issue.type] || '⚠️';
    const severityClass = issue.severity.toLowerCase();
    const typeLabel = issue.type.split('_').join(' ').toUpperCase();

    return `
      <div class="issue-item ${severityClass}">
        <div class="issue-icon">${icon}</div>
        <div class="issue-content">
          <div class="issue-type">${typeLabel}</div>
          <div class="issue-count">${issue.count} ocorrência(s)</div>
        </div>
        <div class="issue-severity severity-${severityClass}">
          ${severityClass}
        </div>
      </div>
    `;
  }).join('');
}

// Insights
function renderInsights(data) {
  const insightsList = document.getElementById('insightsList');
  const insights = [];

  // Insights baseados em dados
  const stats = data.stats || {};
  const patterns = data.patterns || {};
  const messages = data.messages || {};

  if (stats.answer_rate && stats.answer_rate > 70) {
    insights.push('🎉 Taxa de atendimento acima de 70% - Excelente performance!');
  }

  if (patterns.message_previa_impact) {
    const impact = ((patterns.message_previa_impact.with_message_rate || 0) -
                    (patterns.message_previa_impact.without_message_rate || 0)).toFixed(1);
    if (impact > 10) {
      insights.push(`📈 Enviar mensagem antes de ligar melhora ${impact}% o atendimento`);
    }
  }

  if (messages.types && messages.types.length > 0) {
    const best = messages.types[0];
    const worst = messages.types[messages.types.length - 1];
    if (best && worst) {
      const diff = (best.response_rate - worst.response_rate).toFixed(1);
      insights.push(`💬 Mensagem de "${best.type}" é ${diff}% mais efetiva que "${worst.type}"`);
    }
  }

  if (patterns.hourly_patterns && patterns.hourly_patterns.length > 0) {
    const best = patterns.hourly_patterns.reduce((a, b) => a.rate > b.rate ? a : b);
    const worst = patterns.hourly_patterns.reduce((a, b) => a.rate < b.rate ? a : b);
    if (best.hour && worst.hour && best.rate - worst.rate > 15) {
      insights.push(`🕐 Melhor ligar entre ${best.hour}h-${best.hour + 1}h (${best.rate.toFixed(1)}% de atendimento)`);
    }
  }

  if (insights.length === 0) {
    insights.push('Dados insuficientes para gerar insights');
  }

  insightsList.innerHTML = insights.map(insight =>
    `<li>${insight}</li>`
  ).join('');
}

// Utilitários
function formatDuration(seconds) {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function showLoading(show) {
  elements.loadingSpinner.style.display = show ? 'flex' : 'none';
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.style.display = 'block';
}

function clearError() {
  elements.errorMessage.style.display = 'none';
}
