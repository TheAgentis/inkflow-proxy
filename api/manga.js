// api/manga.js — Serverless scraper for MangaKakalot via mangakakalot.tv
// Deployed alongside proxy.js on Vercel

const BASE = 'https://ww6.mangakakalot.tv';

async function fetchHTML(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': BASE,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

function extractBetween(str, start, end) {
  const si = str.indexOf(start);
  if (si === -1) return '';
  const ei = str.indexOf(end, si + start.length);
  if (ei === -1) return '';
  return str.slice(si + start.length, ei).trim();
}

function parseList(html) {
  const items = [];
  // Find all manga story items
  const itemRegex = /<div class="story_item(?:_right)?[^"]*">([\s\S]*?)<\/div>\s*<\/div>/g;
  // simpler: find all <h3 class="story_name"> blocks
  const blocks = html.split('<div class="story_item"');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    // extract link + id
    const hrefMatch = block.match(/href="([^"]+)"/);
    const href = hrefMatch ? hrefMatch[1] : '';
    const id = href.replace(BASE + '/', '').replace(/\/$/, '');
    // extract title
    const titleMatch = block.match(/title="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : '';
    // extract image
    const imgMatch = block.match(/src="([^"]+)"/);
    const image = imgMatch ? imgMatch[1] : '';
    // extract latest chapter
    const chMatch = block.match(/chapter[^"]*">([^<]+)/i);
    const chapter = chMatch ? chMatch[1].trim() : '';
    if (id && title) items.push({ id, title, image, chapter, href });
  }
  return items;
}

function parseDetail(html, id) {
  const title = extractBetween(html, 'class="manga-title">', '<');
  const desc = extractBetween(html, 'class="panel-story-description">', '</div>').replace(/<[^>]+>/g, '').trim();
  const imgMatch = html.match(/class="manga-info-pic"[\s\S]*?src="([^"]+)"/);
  const image = imgMatch ? imgMatch[1] : '';
  const statusMatch = html.match(/Status\s*:[\s\S]*?<em[^>]*>([^<]+)<\/em>/);
  const status = statusMatch ? statusMatch[1].trim() : '';
  const authorMatch = html.match(/Author\s*:[\s\S]*?<em[^>]*>([^<]+)<\/em>/);
  const author = authorMatch ? authorMatch[1].trim() : '';

  // chapters
  const chapters = [];
  const chBlocks = html.split('<li class="a-h"');
  for (let i = 1; i < chBlocks.length; i++) {
    const b = chBlocks[i];
    const hrefMatch = b.match(/href="([^"]+)"/);
    const href = hrefMatch ? hrefMatch[1] : '';
    const chId = href.replace(BASE + '/', '').replace(/\/$/, '');
    const nameMatch = b.match(/<a[^>]+>([^<]+)<\/a>/);
    const name = nameMatch ? nameMatch[1].trim() : '';
    const numMatch = name.match(/chapter[\s-]+(\d+(?:\.\d+)?)/i);
    const num = numMatch ? numMatch[1] : '';
    const dateMatch = b.match(/title="([^"]+)"/);
    const date = dateMatch ? dateMatch[1] : '';
    if (chId) chapters.push({ id: chId, name, num, date });
  }
  // chapters are newest-first from site, reverse to oldest-first
  chapters.reverse();
  return { id, title, image, desc, status, author, chapters };
}

function parsePages(html) {
  const pages = [];
  const regex = /data-src="([^"]+)"/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const src = m[1].trim();
    if (src && (src.includes('.jpg') || src.includes('.png') || src.includes('.webp'))) {
      pages.push(src);
    }
  }
  return pages;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, page = '1', category = 'all', type = 'topview', q, id, chid } = req.query;

  try {
    if (action === 'list' || !action) {
      const url = `${BASE}/manga-list.html?type=${type}&category=${category}&state=all&page=${page}`;
      const html = await fetchHTML(url);
      const items = parseList(html);
      return res.status(200).json({ items });
    }
    if (action === 'search') {
      if (!q) return res.status(400).json({ error: 'Missing q' });
      const url = `${BASE}/search/story/${encodeURIComponent(q.replace(/\s+/g, '_'))}`;
      const html = await fetchHTML(url);
      const items = parseList(html);
      return res.status(200).json({ items });
    }
    if (action === 'detail') {
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const url = id.startsWith('http') ? id : `${BASE}/${id}`;
      const html = await fetchHTML(url);
      const detail = parseDetail(html, id);
      return res.status(200).json(detail);
    }
    if (action === 'pages') {
      if (!chid) return res.status(400).json({ error: 'Missing chid' });
      const url = chid.startsWith('http') ? chid : `${BASE}/${chid}`;
      const html = await fetchHTML(url);
      const pages = parsePages(html);
      return res.status(200).json({ pages });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
