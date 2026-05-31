export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';

    // Remove headers that block iframe
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
      const origin = new URL(url).origin;  // e.g. https://www.babaluu.me

      // Rewrite relative URLs to absolute
      html = html.replace(
        /(src|href|action)=["'](?!https?:\/\/)([^"']+)["']/gi,
        (match, attr, link) => {
          if (link.startsWith('//')) {
            return `${attr}="https:${link}"`;
          }
          if (link.startsWith('/')) {
            return `${attr}="${origin}${link}"`;
          }
          // relative path (e.g. "js/app.js")
          return `${attr}="${origin}/${link}"`;
        }
      );

      // Also fix srcset attributes (optional, but good to have)
      html = html.replace(
        /srcset=["']([^"']+)["']/gi,
        (match, srcset) => {
          const parts = srcset.split(',').map(part => {
            const trimmed = part.trim();
            if (trimmed.startsWith('http')) return trimmed;
            if (trimmed.startsWith('/')) return origin + trimmed;
            return origin + '/' + trimmed;
          });
          return `srcset="${parts.join(', ')}"`;
        }
      );

      res.end(html);
    } else {
      // For non-HTML resources (JS, CSS, images), pipe them directly
      // This avoids the double-proxy issue by letting the browser fetch these from the original server.
      // However, note that some resources may still be blocked by CORS if the original server doesn't allow.
      // In that case, we'd need to proxy those as well, but that's complex.
      // For now, we let the browser fetch them directly (they will be loaded from babaluu.me).
      // We need to set the correct content-type and send the body.
      res.end(response.body);
    }
  } catch (e) {
    res.status(500).json({ error: 'Proxy error' });
  }
}
