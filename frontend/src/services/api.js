async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Não foi possível concluir a solicitação.');
    error.code = payload?.error?.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const api = {
  me: () => request('/auth/me'),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  lookupCep: (cep) => request(`/locations/cep/${encodeURIComponent(cep)}`),
  favorites: () => request('/favorites'),
  favorite: (id) => request(`/favorites/${id}`),
  saveFavorite: (snapshot) => request('/favorites', { method: 'POST', body: JSON.stringify({ snapshot }) }),
  refreshFavorite: (id) => request(`/favorites/${id}/refresh`, { method: 'PUT' }),
  removeFavorite: (id) => request(`/favorites/${id}`, { method: 'DELETE' }),
};
