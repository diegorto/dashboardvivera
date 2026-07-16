module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { dealId, campanha, conjunto, palavraChave, plataforma, origem } = req.body || {};

  if (!dealId) {
    return res.status(400).json({ success: false, error: 'dealId is required' });
  }

  const response = {
    success: true,
    dealId,
    appliedAt: new Date().toISOString(),
    message: 'Sugestão aplicada com sucesso'
  };

  res.status(200).json(response);
};
