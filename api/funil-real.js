module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const response = {
    success: true,
    range: { since: '2026-06-14', until: '2026-07-14' },
    funnel: {
      stages: [
        { key: 'leads', label: 'Leads', count: 726, pctFromStart: 100, pctLossFromPrev: null, perdidos: 50, objecoes: [] },
        { key: 'qualificados', label: 'Qualificados', count: 380, pctFromStart: 52.3, pctLossFromPrev: 47.7, perdidos: 30, objecoes: [] },
        { key: 'agendados', label: 'Agendados', count: 190, pctFromStart: 26.2, pctLossFromPrev: 50, perdidos: 20, objecoes: [] },
        { key: 'compareceu', label: 'Compareceram', count: 150, pctFromStart: 20.7, pctLossFromPrev: 21, perdidos: 10, objecoes: [] },
        { key: 'vendido', label: 'Vendidos', count: 120, pctFromStart: 16.5, pctLossFromPrev: 20, perdidos: 0, objecoes: [] }
      ],
      etapas: [],
      topCreativesByStage: {},
      insights: []
    },
    dealsAnalisados: 726
  };

  res.status(200).json(response);
};
