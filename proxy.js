// api/proxy.js  — Vercel serverless function
// Proxies MangaDex, Comick, and MangaReader requests with CORS headers

const ALLOWED = [
  'api.mangadex.org',
  'uploads.mangadex.org',
  'api.comick.fun',
  'meo.comick.pictures',
  'cmdxd98sb0x3yprd.mangadex.network',
];

export default async function handler(req, res) {
  // CORS — allow your GitHub Pages site (and any origin for simplicity)
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
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  // Security: only proxy allowed domains
  const host = parsed.hostname;
  const allowed = ALLOWED.some(a => host === a || host.endsWith('.' + a));
  if (!allowed) {
    res.status(403).json({ error: 'Domain not allowed: ' + host });
    return;
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': 'Inkflow/1.0 (manga reader; contact@inkflow)',
        'Referer': 'https://mangadex.org/',
      },
      signal: AbortSignal.timeout(15000),
    });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(upstream.status);

    // Stream the body
    const buffer = await upstream.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(502).json({ error: 'Upstream error: ' + err.message });
  }
}
