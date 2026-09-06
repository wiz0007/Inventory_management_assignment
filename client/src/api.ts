// Secure API Client with httpOnly Cookie & Anti-CSRF Protection

const API_BASE = '/api';

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'StockPulse-Client', // Anti-CSRF Header
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Automatically sends secure httpOnly cookie
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || (data.details ? data.details.map((d: any) => d.message).join(', ') : 'Request failed');
    throw new Error(errorMsg);
  }

  return data as T;
}
