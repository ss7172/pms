const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

/**
 * Core fetch wrapper. Attaches JWT token, handles 401, parses JSON.
 */
async function apiClient(endpoint, options = {}) {
  const token = localStorage.getItem('access_token');

  const config = {
    headers: {
      // Don't set Content-Type for FormData — browser sets it with boundary
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...options,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  // Token expired or invalid — log out
  if (response.status === 401) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return;
  }

  const data = await response.json();

  if (!response.ok) {
    throw data; // { error: "message" }
  }

  return data;
}

export const api = {
  get: (url) => apiClient(url),
  post: (url, data) =>
    apiClient(url, { method: 'POST', body: JSON.stringify(data) }),
  put: (url, data) =>
    apiClient(url, { method: 'PUT', body: JSON.stringify(data) }),
  patch: (url, data) =>
    apiClient(url, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (url) => apiClient(url, { method: 'DELETE' }),
  upload: (url, formData) =>
    apiClient(url, { method: 'POST', body: formData }),
};