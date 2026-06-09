export default async function handler(req, res) {
  let url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';

    // Ukloni blokirajuća zaglavlja
    const headers = {};
    for (const [key, value] of response.headers) {
      const lower = key.toLowerCase();
      if (lower !== 'x-frame-options' && lower !== 'content-security-policy') {
        headers[key] = value;
      }
    }
    headers['access-control-allow-origin'] = '*';
    res.writeHead(response.status, headers);

    if (contentType.includes('text/html')) {
      let html = await response.text();
      const origin = new URL(url).origin;

      // Prepravi SVE relativne i apsolutne URL‑ove da idu kroz proxy
      html = html.replace(
        /(src|href|action)=["']([^"']+)["']/gi,
        (match, attr, link) => {
          if (link.startsWith('http')) {
            return `${attr}="/api/proxy?url=${encodeURIComponent(link)}"`;
          }
          if (link.startsWith('//')) {
            return `${attr}="/api/proxy?url=${encodeURIComponent('https:' + link)}"`;
          }
          if (link.startsWith('/')) {
            return `${attr}="/api/proxy?url=${encodeURIComponent(origin + link)}"`;
          }
          return `${attr}="/api/proxy?url=${encodeURIComponent(origin + '/' + link)}"`;
        }
      );

      // Prepravi srcset atribut
      html = html.replace(
        /srcset=["']([^"']+)["']/gi,
        (match, srcset) => {
          const parts = srcset.split(',').map(part => {
            let trimmed = part.trim();
            if (trimmed.startsWith('http')) return `/api/proxy?url=${encodeURIComponent(trimmed)}`;
            if (trimmed.startsWith('//')) return `/api/proxy?url=${encodeURIComponent('https:' + trimmed)}`;
            if (trimmed.startsWith('/')) return `/api/proxy?url=${encodeURIComponent(origin + trimmed)}`;
            return `/api/proxy?url=${encodeURIComponent(origin + '/' + trimmed)}`;
          });
          return `srcset="${parts.join(', ')}"`;
        }
      );

      res.end(html);
    } else {
      // Za slike, CSS, JS – direktno prosledi sadržaj
      const buffer = await response.arrayBuffer();
      res.end(Buffer.from(buffer));
    }
  } catch (e) {
    res.status(500).json({ error: 'Proxy error' });
  }
}
