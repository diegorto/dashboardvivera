module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const response = {
    success: true,
    deals: [
      {
        dealId: 1,
        dealName: 'João Silva - Botox',
        pipedriveUrl: 'https://vivera.pipedrive.com/deal/1',
        creativeUsed: '02 [VD] - BOTOX',
        suggestions: [
          {
            field: 'campanha',
            currentValue: null,
            suggestedValue: 'PAT | [HOF][MELHORES CRIATIVOS]',
            confidence: 0.95
          }
        ],
        status: 'pending'
      }
    ],
    totalDealsNeedingAudit: 15,
    lastAuditedAt: new Date().toISOString()
  };

  res.status(200).json(response);
};
