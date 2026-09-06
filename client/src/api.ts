// API Client for Inventory & Stock Control

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('stockpulse_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('stockpulse_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('stockpulse_token');
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || (data.details ? data.details.map((d: any) => d.message).join(', ') : 'Request failed');
    throw new Error(errorMsg);
  }

  return data as T;
}
