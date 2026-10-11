// Backend API client
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export const api = {
  // Authors endpoints
  authors: {
    list: () => fetch(`${API_BASE}/authors`).then(r => r.json()),
    get: (id) => fetch(`${API_BASE}/authors/${id}`).then(r => r.json()),
    create: (data) => fetch(`${API_BASE}/authors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    update: (id, data) => fetch(`${API_BASE}/authors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    delete: (id) => fetch(`${API_BASE}/authors/${id}`, { method: 'DELETE' }).then(r => r.ok),
  },
  // Quotes endpoints
  quotes: {
    list: (authorId) => {
      const params = authorId ? `?authorId=${authorId}` : '';
      return fetch(`${API_BASE}/quotes${params}`).then(r => r.json());
    },
  },
};
