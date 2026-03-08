// Centralized API configuration
// Using Render backend (already deployed)
export const API_BASE_URL = 'https://churchtrack-api.onrender.com';

// Direct API call (no proxy needed - Render handles CORS)
export const apiCall = async (endpoint, options = {}) => {
  const { method = 'POST', data = {}, headers = {} } = options;
  
  try {
    const fetchOptions = {
      method: method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...headers
      }
    };

    // Add body for POST requests
    if (method !== 'GET' && data) {
      fetchOptions.body = new URLSearchParams(data).toString();
    }

    // For GET requests, append data as query parameters
    let url = `${API_BASE_URL}${endpoint}`;
    if (method === 'GET' && data && Object.keys(data).length > 0) {
      const params = new URLSearchParams(data);
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, fetchOptions);
    return await response.json();
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
};

// Legacy support
export const getApiUrl = () => API_BASE_URL;
