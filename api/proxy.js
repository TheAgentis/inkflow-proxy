// api/proxy.js — Vercel serverless function (CommonJS)

function isAllowed(host) {
  const allowed = [
    'api.mangadex.org',
    'uploads.mangadex.org',
  ];
  if (allowed.includes(host)) return true;
  if (host.includes('mangadex')) return true;
  return false;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const target = req.query.url;
  if (!target) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL: ' + target });
  }

  if (!isAllowed(parsed.hostname)) {
    return res.status(403).json({ error: 'Domain not allowed: ' + parsed.hostname });
  }

  try {
    const response = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Inkflow/1.0)',
        'Referer': 'https://mangadex.org/',
        'Origin': 'https://mangadex.org',
      },
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(response.status);

    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err) {
    return res.status(502).json({ error: err.message, target });
  }
};
