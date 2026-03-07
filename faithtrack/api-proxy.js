// Simple proxy to bypass CORS issues
export default async function handler(req, res) {
  const apiUrl = 'http://churchtrack.infinityfreeapp.com';
  const path = req.url.replace('/api-proxy', '');
  
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
