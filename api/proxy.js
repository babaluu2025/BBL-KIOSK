export default async function handler(req, res) {
  let url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';

    // Postavi zaglavlja
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

      // Prepravi SVE linkove da idu kroz naš proxy
      html = html.replace(
        /(src|href|action)=["']([^"']+)["']/gi,
        (match, attr, link) => {
          // Ako je već apsolutni URL (počinje sa http)
          if (link.startsWith('http')) {
            return `${attr}="/api/proxy?url=${encodeURIComponent(link)}"`;
          }
          // Ako počinje sa //
          if (link.startsWith('//')) {
            return `${attr}="/api/proxy?url=${encodeURIComponent('https:' + link)}"`;
          }
          // Ako je relativni put koji počinje sa /
          if (link.startsWith('/')) {
            return `${attr}="/api/proxy?url=${encodeURIComponent(origin + link)}"`;
          }
          // Relativni put bez /
          return `${attr}="/api/proxy?url=${encodeURIComponent(origin + '/' + link)}"`;
        }
      );

      res.end(html);
    } else {
      // Za slike, CSS, JS – direktno prosledi
      const buffer = await response.arrayBuffer();
      res.end(Buffer.from(buffer));
    }
  } catch (e) {
    res.status(500).json({ error: 'Proxy error' });
  }
}
