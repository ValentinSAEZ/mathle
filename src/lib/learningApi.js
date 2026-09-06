const API_URL = 'https://api.brainteaserday.com';

export async function learningApi(path, { signal, body } = {}) {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_URL}/api/learning${path}`, {
    method: body ? 'POST' : 'GET', signal,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Cet espace est temporairement indisponible. Réessaie dans un instant.');
  return data;
}
