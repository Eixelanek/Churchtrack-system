// Netlify Function to proxy API requests to InfinityFree backend
// This bypasses CORS issues and InfinityFree's anti-bot protection

// Simple in-memory cookie store (resets on cold start)
let cookieStore = {};

exports.handler = async (event, context) => {
  // Allow POST and OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse the request body
    const body = JSON.parse(event.body);
    const { endpoint, method = 'POST', data } = body;

    if (!endpoint) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Endpoint is required' })
      };
    }

    // Build the full URL
    const baseUrl = 'https://churchtrack.infinityfreeapp.com';
    let url = `${baseUrl}${endpoint}`;

    // For GET requests, append data as query parameters
    if (method === 'GET' && data && Object.keys(data).length > 0) {
      const params = new URLSearchParams(data);
      url += `?${params.toString()}`;
    }

    // Prepare headers with cookies
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': baseUrl,
      'Origin': baseUrl
    };

    // Add stored cookies if any
    const domain = 'churchtrack.infinityfreeapp.com';
    if (cookieStore[domain]) {
      headers['Cookie'] = cookieStore[domain];
    }

    // Make the request to InfinityFree backend
    const fetchOptions = {
      method: method === 'GET' ? 'GET' : 'POST',
      headers: headers,
      redirect: 'follow'
    };

    // Add body for POST requests
    if (method !== 'GET' && data) {
      fetchOptions.body = new URLSearchParams(data).toString();
    }

    const response = await fetch(url, fetchOptions);
    
    // Store cookies from response
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      cookieStore[domain] = setCookie.split(';')[0];
    }

    const responseData = await response.text();
    
    // Try to parse as JSON, fallback to text
    let jsonData;
    try {
      jsonData = JSON.parse(responseData);
    } catch (e) {
      // If response is HTML (anti-bot page), try to handle it
      if (responseData.includes('<html>') || responseData.includes('<script>')) {
        // Check if it's the anti-bot challenge
        if (responseData.includes('slowAES.decrypt') || responseData.includes('__test=')) {
          // Extract and execute the challenge (simplified approach)
          // For now, return a more helpful error
          return {
            statusCode: 503,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
              success: false,
              error: 'InfinityFree anti-bot protection is active',
              message: 'The free hosting service is blocking automated requests. Consider upgrading to a paid hosting service for better reliability.',
              suggestion: 'Try accessing the site directly in your browser first, then refresh this page.'
            })
          };
        }
        return {
          statusCode: 503,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            success: false,
            error: 'Backend returned HTML instead of JSON',
            message: 'The backend server may be experiencing issues'
          })
        };
      }
      jsonData = { rawResponse: responseData };
    }

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
      },
      body: JSON.stringify(jsonData)
    };

  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        error: 'Proxy error', 
        message: error.message 
      })
    };
  }
};
