// api/proxy.js  — Vercel serverless function
// Proxies MangaDex, Comick requests with CORS headers

const ALLOWED = [
  'api.mangadex.org',
  'uploads.mangadex.org',
  'api.comick.fun',
  'meo.comick.pictures',
  'meo2.comick.pictures',
  // MangaDex at-home CDN — dynamic hostnames, allow all subdomains
  'mangadex.network',
  'mangadex.org',
  // some MangaDex CDN nodes use s2/s5 style hostnames
  's2.mangadex.org',
  's5.mangadex.org',
];

function isAllowed(host) {
  // exact match
  if (ALLOWED.includes(host)) return true;
  // subdomain match — e.g. abc123.mangadex.network
  for (const a of ALLOWED) {
    if (host.endsWith('.' + a)) return true;
  }
  // allow any *.mangadex.* domain for CDN flexibility
  if (host.includes('mangadex')) return true;
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const target = req.query.url;
  if (!target) {
    res.status(400).json({ error: 'Missing ?url= parameter' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    res.status(400).json({ error: 'Invalid URL: ' + target });
    return;
  }

  const host = parsed.hostname;
  if (!isAllowed(host)) {
    res.status(403).json({ error: 'Domain not allowed: ' + host });
    return;
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Inkflow/1.0)',
        'Referer': 'https://mangadex.org/',
        'Origin': 'https://mangadex.org',
      },
      signal: AbortSignal.timeout(20000),
    });

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(upstream.status);

    const buffer = await upstream.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(502).json({ error: 'Upstream fetch failed: ' + err.message, target });
  }
}
