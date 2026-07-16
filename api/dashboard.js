module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { since = '2026-06-14', until = '2026-07-14' } = req.query;

  const dashboardData = {
    success: true,
    range: { since, until },
    previousRange: { since: '2026-05-14', until: '2026-06-14' },
    kpis: {
      receita: { current: 45000, deltaPct: 12.5 },
      compras: { current: 150, deltaPct: -5 },
      ticketMedio: { current: 300, deltaPct: 0 },
      tempoMedioFechamento: { current: 5, deltaPct: 2 },
      investimento: { current: 8000, deltaPct: 10 },
      roas: { current: 5.6, deltaPct: 15 },
      cac: { current: 53, deltaPct: -8 }
    },
    creatives: [
      {
        campanha: 'PAT | [HOF][MELHORES CRIATIVOS]',
        conjunto: '[QUENTE][MELHORES CRIATIVOS][IG]',
        anuncio: '02 [VD] - BOTOX',
        investimento: 474.46,
        leads: 18,
        mensagensMeta: 8,
        qualificados: 2,
        agendados: 1,
        compareceram: 1,
        compras: 0,
        perdidos: 1,
        objecoes: [
          { tag: 'preço alto', count: 3 },
          { tag: 'sem interesse', count: 2 }
        ],
        receita: 0,
        roas: 0,
        receitaPorLead: 0,
        receitaPorAgendamento: 0,
        ctr: 2.1,
        cpc: 26.3,
        impressoes: 850,
        cliques: 18,
        trend: [10, 12, 15, 18],
        trendDirection: 'up',
        status: 'escalar',
        thumbnailUrl: null,
        adUrl: null,
        adStatus: null,
        adId: null
      }
    ],
    funnel: {
      stages: [
        {
          key: 'leads',
          label: 'Leads Recebidos',
          count: 726,
          pctFromStart: 100,
          pctLossFromPrev: null,
          perdidos: 50,
          objecoes: [{ tag: 'sem interesse', count: 50 }]
        },
        {
          key: 'qualificados',
          label: 'Qualificados',
          count: 380,
          pctFromStart: 52.3,
          pctLossFromPrev: 47.7,
          perdidos: 30,
          objecoes: []
        },
        {
          key: 'agendados',
          label: 'Agendados',
          count: 190,
          pctFromStart: 26.2,
          pctLossFromPrev: 50,
          perdidos: 20,
          objecoes: []
        },
        {
          key: 'compareceu',
          label: 'Compareceram',
          count: 150,
          pctFromStart: 20.7,
          pctLossFromPrev: 21,
          perdidos: 10,
          objecoes: []
        },
        {
          key: 'vendido',
          label: 'Vendidos',
          count: 120,
          pctFromStart: 16.5,
          pctLossFromPrev: 20,
          perdidos: 0,
          objecoes: []
        }
      ],
      etapas: [],
      topCreativesByStage: {},
      insights: []
    },
    pipeline: {
      buckets: [
        { label: 'Até 7 dias', count: 45, potentialValue: 13500, deals: [] },
        { label: '8-15 dias', count: 32, potentialValue: 9600, deals: [] },
        { label: '15-30 dias', count: 28, potentialValue: 8400, deals: [] },
        { label: 'Acima de 30 dias', count: 15, potentialValue: 4500, deals: [] }
      ],
      etapas: [],
      stuckCreatives: [],
      slowestCampaigns: []
    },
    patients: [
      {
        id: 1,
        nome: 'João Silva',
        telefone: '48999999999',
        criativo: '02 [VD] - BOTOX',
        campanha: 'PAT | [HOF][MELHORES CRIATIVOS]',
        conjunto: '[QUENTE][MELHORES CRIATIVOS][IG]',
        closer: null,
        sdr: 'Maria',
        procedimento: 'open',
        valor: 0,
        dataLead: '2026-07-01',
        dataVenda: null,
        status: 'open',
        tempoAteFechar: null,
        pipedriveUrl: 'https://vivera.pipedrive.com/deal/1'
      }
    ],
    governance: {
      semResponsavel: { count: 15, value: 4500 }
    },
    revenueAtRisk: {
      qualificadosSemAgendamento: { count: 50, semOrcamento: 10, value: 15000, deals: [] },
      agendadosFaltaram: { count: 20, semOrcamento: 5, value: 6000, deals: [] },
      propostasSemFechamento: { count: 35, semOrcamento: 8, value: 10500, deals: [] },
      total: 31500
    },
    revenueAtRiskRange: { since: '2026-04-14', until: '2026-07-14' },
    insights: [
      { id: 'insight-1', severity: 'critical', text: 'ROAS está abaixo do esperado - investigar criativos com performance baixa' }
    ],
    leadsSemOrigem: [],
    recepcao: {
      kpis: {
        receita: { current: 12000, deltaPct: 8 },
        compras: { current: 40, deltaPct: 5 },
        ticketMedio: { current: 300, deltaPct: 2 }
      },
      fechamentos: [
        {
          id: 1,
          nome: 'Procedimento A',
          telefone: '48999999999',
          procedimento: 'Preenchimento',
          closer: 'João',
          responsavel: 'Maria',
          valor: 1500,
          dataFechamento: '2026-07-05',
          pipedriveUrl: 'https://vivera.pipedrive.com/deal/1'
        }
      ]
    },
    faturamentoTotal: { current: 57000, deltaPct: 10 },
    meta: { adsAccounts: 2, totalAdsComGasto: 75, totalDealsNoPeriodo: 726 },
    summary: {
      leads_entrada: 726,
      leads_qualificados: 380,
      agendamentos: 190,
      comparecimentos: 150,
      fechamentos: 120,
      revenue: 57000,
      ligacoes: 250,
      orcamentos: 180,
      perdidos: 120
    },
    origens: [],
    detalhesPorEtapa: {
      leads: [],
      qualificados: [],
      agendados: [],
      compareceram: [],
      vendas: [],
      perdidos: []
    }
  };

  res.status(200).json(dashboardData);
};
