// api/proxy.js
export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const contentType = response.headers.get('content-type') || 'text/html';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Ukloni blokirajuća zaglavlja
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('x-frame-options');
    responseHeaders.delete('content-security-policy');
    responseHeaders.delete('x-content-type-options');

    // Prosledi sve ostale heder-e osim problematičnih
    for (const [key, value] of responseHeaders) {
      if (!['transfer-encoding', 'content-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }

    res.status(response.status);

    // Ako je HTML, prepravi putanje ka resursima
    if (contentType.includes('text/html')) {
      let html = await response.text();
      const baseUrl = new URL(url);
      const baseOrigin = baseUrl.origin;

      // Zameni relativne putanje apsolutnim
      html = html.replace(/(href|src|action)="\//g, `$1="${baseOrigin}/`);
      html = html.replace(/(href|src|action)="\.\//g, `$1="${baseOrigin}/`);
      html = html.replace(/url\(\//g, `url(${baseOrigin}/`);

      // Ukloni X-Frame-Options meta tagove
      html = html.replace(/<meta[^>]*http-equiv=["']X-Frame-Options[^>]*>/gi, '');
      html = html.replace(/<meta[^>]*content=["']X-Frame-Options[^>]*>/gi, '');

      // Dodaj base tag da bi relativni linkovi radili
      html = html.replace('<head>', `<head><base href="${baseUrl.origin}/">`);

      res.send(html);
    } else {
      // Za sve ostale fajlove (slike, CSS, JS) – samo prosledi
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error' });
  }
}
