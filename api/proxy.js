// api/proxy.js
export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const response = await fetch(url);
    const body = await response.text();
    
    // Kopiramo sve heder-e osim onih koji blokiraju iframe
    const headers = {};
    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower !== 'x-frame-options' && lower !== 'content-security-policy') {
        headers[key] = value;
      }
    });

    res.writeHead(response.status, {
      ...headers,
      'content-type': response.headers.get('content-type') || 'text/html',
      'access-control-allow-origin': '*',
    });
    res.end(body);
  } catch (e) {
    res.status(500).json({ error: 'Proxy error' });
  }
}
