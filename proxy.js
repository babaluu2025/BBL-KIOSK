export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const headers = new Headers(response.headers);

    // Uklanjamo zaglavlja koja blokiraju iframe
    headers.delete('x-frame-options');
    headers.delete('content-security-policy');
    headers.set('access-control-allow-origin', '*');

    // Prosleđujemo sve ostale heder-e
    for (const [key, value] of headers) {
      res.setHeader(key, value);
    }
    res.writeHead(response.status);
    res.end(Buffer.from(buffer));
  } catch (e) {
    res.status(500).json({ error: 'Proxy error' });
  }
}
