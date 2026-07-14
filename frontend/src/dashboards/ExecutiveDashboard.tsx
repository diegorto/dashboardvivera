import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { KPICard, Funnel, AIInsight, AIInsightPanel } from '../components';
import { COLORS, SPACING } from '../styles/tokens';

// Mock data
const mockChartData = [
  { date: '01', revenue: 45000, meta: 40000, forecast: 48000 },
  { date: '02', revenue: 52000, meta: 40000, forecast: 51000 },
  { date: '03', revenue: 48000, meta: 40000, forecast: 50000 },
  { date: '04', revenue: 61000, meta: 40000, forecast: 55000 },
  { date: '05', revenue: 55000, meta: 40000, forecast: 56000 },
  { date: '06', revenue: 67000, meta: 40000, forecast: 60000 },
  { date: '07', revenue: 72000, meta: 40000, forecast: 65000 },
];

const mockFunnelData = [
  {
    name: 'Leads',
    quantity: 500,
    percentage: 100,
    revenue: 0,
    lostRevenue: 0,
    averageTime: 0,
    conversion: 100,
  },
  {
    name: 'Qualificados',
    quantity: 350,
    percentage: 70,
    revenue: 0,
    lostRevenue: 75000,
    averageTime: 3,
    conversion: 70,
  },
  {
    name: 'Agendados',
    quantity: 245,
    percentage: 49,
    revenue: 0,
    lostRevenue: 52500,
    averageTime: 5,
    conversion: 70,
  },
  {
    name: 'Compareceram',
    quantity: 220,
    percentage: 44,
    revenue: 0,
    lostRevenue: 56250,
    averageTime: 2,
    conversion: 90,
  },
  {
    name: 'Compraram',
    quantity: 170,
    percentage: 34,
    revenue: 340000,
    lostRevenue: 50000,
    averageTime: 7,
    conversion: 77,
  },
];

const mockOriginData = [
  { name: 'Google', value: 45, revenue: 153000 },
  { name: 'Meta', value: 28, revenue: 95200 },
  { name: 'Orgânico', value: 15, revenue: 51000 },
  { name: 'Indicação', value: 8, revenue: 27200 },
  { name: 'Recepção', value: 4, revenue: 13600 },
];

const mockProcedureData = [
  { name: 'Implantes', value: 35, revenue: 119000 },
  { name: 'Invisalign', value: 25, revenue: 85000 },
  { name: 'Evolution', value: 20, revenue: 68000 },
  { name: 'Ultraformer', value: 12, revenue: 40800 },
  { name: 'Papada', value: 8, revenue: 27200 },
];

const ExecutiveDashboard: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');

  const kpis = [
    {
      title: 'Receita',
      value: 340000,
      comparison: 12.5,
      comparisonText: 'vs mês anterior',
      icon: '💰',
      status: 'ok' as const,
      format: 'currency' as const,
      sparkline: [45, 52, 48, 61, 55, 67, 72],
    },
    {
      title: 'Meta',
      value: 280000,
      comparison: 0,
      comparisonText: 'objetivo mensal',
      icon: '🎯',
      status: 'ok' as const,
      format: 'currency' as const,
    },
    {
      title: '% da Meta',
      value: 121.4,
      comparison: 12.5,
      comparisonText: 'acima da meta',
      icon: '📈',
      status: 'ok' as const,
      format: 'percentage' as const,
    },
    {
      title: 'Receita Prevista IA',
      value: 380000,
      comparison: 11.8,
      comparisonText: 'previsão para mês',
      icon: '🤖',
      status: 'ok' as const,
      format: 'currency' as const,
    },
    {
      title: 'Lucro',
      value: 170000,
      comparison: 15.3,
      comparisonText: 'vs mês anterior',
      icon: '📊',
      status: 'ok' as const,
      format: 'currency' as const,
    },
    {
      title: 'ROAS',
      value: 4.25,
      comparison: 8.5,
      comparisonText: 'efetividade',
      icon: '💹',
      status: 'ok' as const,
      format: 'number' as const,
    },
    {
      title: 'CAC',
      value: 500,
      comparison: -5.2,
      comparisonText: 'custo de aquisição',
      icon: '💳',
      status: 'ok' as const,
      format: 'currency' as const,
    },
    {
      title: 'Ticket Médio',
      value: 2000,
      comparison: 3.8,
      comparisonText: 'vs mês anterior',
      icon: '🏷️',
      status: 'ok' as const,
      format: 'currency' as const,
    },
  ];

  const aiInsights = [
    {
      title: 'Maior Gargalo',
      value: 'Lead → Qualificado',
      description: '30% de conversão',
      icon: '⚠️',
      color: COLORS.critical[400],
    },
    {
      title: 'Maior Oportunidade',
      value: 'Campanha Google',
      description: 'ROAS 5.2x',
      icon: '🎯',
      color: COLORS.success[400],
    },
    {
      title: 'Melhor Profissional',
      value: 'Dr. João Silva',
      description: 'Ticket R$ 2.500',
      icon: '👨‍⚕️',
      color: COLORS.primary[400],
    },
    {
      title: 'Melhor SDR',
      value: 'Maria Santos',
      description: '45% de conversão',
      icon: '📞',
      color: COLORS.info[400],
    },
  ];

  const COLORS_CHART = [COLORS.primary[400], COLORS.success[400], COLORS.alert[400], COLORS.critical[400], COLORS.info[400]];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xl,
      }}
    >
      {/* Título e controles */}
      <div>
        <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: SPACING.lg }}>Dashboard Executive</h1>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: SPACING.lg }}>
          Responda em 15 segundos: Estamos batendo a meta? Onde perdemos dinheiro? Qual setor precisa agir?
        </p>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: SPACING.md }}>
          {(['today', 'week', 'month', 'year'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              style={{
                padding: `${SPACING.md} ${SPACING.lg}`,
                backgroundColor: selectedPeriod === period ? COLORS.primary[600] : COLORS.neutral[200],
                color: selectedPeriod === period ? COLORS.neutral[0] : COLORS.neutral[900],
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '12px',
                textTransform: 'uppercase',
              }}
            >
              {period === 'today' && 'Hoje'}
              {period === 'week' && 'Semana'}
              {period === 'month' && 'Mês'}
              {period === 'year' && 'Ano'}
            </button>
          ))}
        </div>
      </div>

      {/* Linha 1: KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: SPACING.lg,
        }}
      >
        {kpis.map((kpi, idx) => (
          <KPICard
            key={idx}
            title={kpi.title}
            value={kpi.value}
            comparison={kpi.comparison}
            comparisonText={kpi.comparisonText}
            icon={kpi.icon}
            status={kpi.status}
            format={kpi.format}
            sparkline={kpi.sparkline}
            onClick={() => console.log(`Drill-down: ${kpi.title}`)}
          />
        ))}
      </div>

      {/* Linha 2: Gráfico Principal + Painel IA */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: SPACING.lg,
        }}
      >
        {/* Gráfico Receita x Meta x Previsão */}
        <div
          style={{
            backgroundColor: COLORS.neutral[0],
            borderRadius: '12px',
            border: `1px solid ${COLORS.neutral[200]}`,
            padding: SPACING.lg,
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: SPACING.lg }}>
            Receita x Meta x Previsão
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke={COLORS.primary[500]} strokeWidth={2} name="Receita Real" />
              <Line type="monotone" dataKey="meta" stroke={COLORS.alert[500]} strokeWidth={2} name="Meta" strokeDasharray="5 5" />
              <Line type="monotone" dataKey="forecast" stroke={COLORS.success[500]} strokeWidth={2} name="Previsão IA" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Painel IA Executivo */}
        <AIInsight insights={aiInsights} />
      </div>

      {/* Linha 3: Funil + Receita por Origem + Receita por Procedimento */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: SPACING.lg,
        }}
      >
        {/* Funil Executivo */}
        <Funnel stages={mockFunnelData} title="Funil Executivo" />

        {/* Receita por Origem */}
        <div
          style={{
            backgroundColor: COLORS.neutral[0],
            borderRadius: '12px',
            border: `1px solid ${COLORS.neutral[200]}`,
            padding: SPACING.lg,
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: SPACING.lg }}>Receita por Origem</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={mockOriginData} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {mockOriginData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS_CHART[index % COLORS_CHART.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ marginTop: SPACING.lg, fontSize: '12px' }}>
            {mockOriginData.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                <span style={{ color: COLORS.neutral[600] }}>{item.name}</span>
                <span style={{ fontWeight: '600', color: COLORS_CHART[idx % COLORS_CHART.length] }}>
                  {item.value}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Receita por Procedimento */}
        <div
          style={{
            backgroundColor: COLORS.neutral[0],
            borderRadius: '12px',
            border: `1px solid ${COLORS.neutral[200]}`,
            padding: SPACING.lg,
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: SPACING.lg }}>Receita por Procedimento</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={mockProcedureData} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {mockProcedureData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS_CHART[index % COLORS_CHART.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ marginTop: SPACING.lg, fontSize: '12px' }}>
            {mockProcedureData.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                <span style={{ color: COLORS.neutral[600] }}>{item.name}</span>
                <span style={{ fontWeight: '600', color: COLORS_CHART[idx % COLORS_CHART.length] }}>
                  {item.value}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Linha 4: Agenda + Alertas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: SPACING.lg,
        }}
      >
        {/* Agenda Card */}
        <div
          style={{
            backgroundColor: COLORS.neutral[0],
            borderRadius: '12px',
            border: `1px solid ${COLORS.neutral[200]}`,
            padding: SPACING.lg,
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: SPACING.lg }}>Agenda</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.lg }}>
            <KPICard
              title="Agenda Hoje"
              value={12}
              comparison={8.3}
              comparisonText="consultas marcadas"
              icon="📅"
              status="ok"
            />
            <KPICard
              title="Comparecimento Previsto"
              value={10}
              comparison={83.3}
              comparisonText="taxa de comparecimento"
              icon="✅"
              status="ok"
            />
          </div>
        </div>

        {/* Alertas */}
        <div
          style={{
            backgroundColor: COLORS.neutral[0],
            borderRadius: '12px',
            border: `1px solid ${COLORS.neutral[200]}`,
            padding: SPACING.lg,
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: SPACING.lg }}>⚠️ Alertas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
            {[
              { type: 'critical', msg: 'Comparecimento caiu 15%' },
              { type: 'warning', msg: 'CAC aumentou 8%' },
              { type: 'warning', msg: 'Campanha saturando' },
            ].map((alert, idx) => (
              <div
                key={idx}
                style={{
                  padding: SPACING.md,
                  backgroundColor: alert.type === 'critical' ? COLORS.critical[50] : COLORS.alert[50],
                  borderLeft: `4px solid ${alert.type === 'critical' ? COLORS.critical[500] : COLORS.alert[500]}`,
                  borderRadius: BORDER_RADIUS.md,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: COLORS.neutral[800],
                }}
              >
                {alert.msg}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Linha 5: Painel "O que exige atenção" */}
      <div
        style={{
          backgroundColor: COLORS.neutral[0],
          borderRadius: '12px',
          border: `2px solid ${COLORS.critical[500]}`,
          padding: SPACING.lg,
        }}
      >
        <AIInsightPanel
          whatHappened="Receita da semana caiu 8% vs semana anterior"
          why="Redução de cliques em campanhas Meta (campanhas saturando)"
          financialImpact={-27200}
          recommendedAction="Pausar criativos de baixo desempenho e escalar creative campeão"
          priority="high"
        />
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
