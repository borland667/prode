const API_BASE = '/api';

export const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const err = new Error(error.error || error.message || `API error: ${response.status}`);
    err.status = response.status;
    err.data = error;
    throw err;
  }

  return await response.json().catch(() => null);
};

export const get = (endpoint) => apiCall(endpoint);

export const post = (endpoint, data) =>
  apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const put = (endpoint, data) =>
  apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const patch = (endpoint, data) =>
  apiCall(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const del = (endpoint) =>
  apiCall(endpoint, {
    method: 'DELETE',
  });
