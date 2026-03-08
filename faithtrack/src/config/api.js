// Centralized API configuration - used by all API calls
// VITE_API_URL can be set in Netlify env vars; defaults to Render backend
const RENDER_API = 'https://churchtrack-api.onrender.com';
export const API_BASE_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : RENDER_API;

export const getApiUrl = () => API_BASE_URL;
