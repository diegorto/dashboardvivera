module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { adId } = req.query;
  const format = req.query.format || 'html';

  if (!adId) {
    return res.status(400).json({ success: false, error: 'adId is required' });
  }

  const response = {
    success: true,
    format,
    html: `<div style="border: 1px solid #ccc; padding: 20px; border-radius: 8px;">
      <h3>Ad Preview: ${adId}</h3>
      <p>Format: ${format}</p>
      <p>Mock ad preview content for ad ID: ${adId}</p>
    </div>`
  };

  res.status(200).json(response);
};
