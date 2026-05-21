// api/proxy.js — Vercel serverless function (CommonJS)

function isAllowed(host) {
  if (host.includes('mangadex')) return true;
  if (host.includes('mangapark')) return true;
  if (host.includes('mangakakalot')) return true;
  if (host.includes('manganelo')) return true;
  if (host.includes('chapmanganelo')) return true;
  if (host.includes('bato.to')) return true;
  if (host.includes('comick')) return true;
  return false;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

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
    const fetchOpts = {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/html, */*',
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Referer': 'https://mangadex.org/',
        'Origin': 'https://mangadex.org',
      },
    };
    if (req.method === 'POST' && req.body) {
      fetchOpts.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(target, fetchOpts);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    res.status(response.status);
    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err) {
    return res.status(502).json({ error: err.message, target });
  }
};
