// api/proxy.js – menja sve relativne linkove da idu kroz proxy
export default async function handler(req, res) {
  let url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  // Dekodiraj ako je već enkodiran
  try { url = decodeURIComponent(url); } catch(e) {}

  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || 'text/html';
    res.setHeader('Content-Type', contentType);
    res.status(response.status);

    if (contentType.includes('text/html')) {
      let html = await response.text();

      // 1. Skini meta tagove koji blokiraju iframe
      html = html.replace(/<meta[^>]*http-equiv=["']X-Frame-Options[^>]*>/gi, '');
      html = html.replace(/<meta[^>]*content=["']X-Frame-Options[^>]*>/gi, '');

      // 2. Prepravi SVE linkove da idu kroz nas proxy
      //    href="..." i src="..."
      const domain = new URL(url).origin; // npr. https://www.babaluu.me

      // a) Apsolutni linkovi koji počinju sa http(s)
      html = html.replace(
        /(href|src)=["'](https?:\/\/[^"']+)["']/gi,
        (match, attr, link) => `${attr}="/api/proxy?url=${encodeURIComponent(link)}"`
      );

      // b) Relativni linkovi koji počinju sa /
      html = html.replace(
        /(href|src)=["'](\/[^"']+)["']/gi,
        (match, attr, link) => `${attr}="/api/proxy?url=${encodeURIComponent(domain + link)}"`
      );

      // c) Relativni linkovi koji ne počinju sa / (npr. "pice.php")
      html = html.replace(
        /(href|src)=["'](?!https?:\/\/|\/)([^"']+)["']/gi,
        (match, attr, link) => `${attr}="/api/proxy?url=${encodeURIComponent(domain + '/' + link)}"`
      );

      res.send(html);
    } else {
      // Za slike, CSS, JS… samo prosledi
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }
  } catch (e) {
    res.status(500).json({ error: 'Proxy error' });
  }
}
