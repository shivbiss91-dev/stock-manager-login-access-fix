/**
 * StockVista Backend API Client
 * Seamlessly interfaces with the SQLite Backend Server on /api
 * Falls back to client-side storage when server is offline (e.g. GitHub Pages static hosting)
 */

export const API_BASE = '/api';

export function isStaticHosting(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return (
    hostname.endsWith('github.io') ||
    hostname.endsWith('pages.dev') ||
    hostname.endsWith('web.app') ||
    hostname.endsWith('vercel.app') ||
    hostname.endsWith('netlify.app')
  );
}

export async function isServerAvailable(): Promise<boolean> {
  if (isStaticHosting()) {
    return false;
  }
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET', signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown
): Promise<T | null> {
  if (isStaticHosting()) {
    // In static hosting environments like GitHub Pages, no backend server is running.
    // Throw immediately to prevent HTTP 405 Method Not Allowed network errors in console.
    throw new Error('Backend server is not available in static hosting environment');
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Request failed with status ${res.status}`);
    }

    return (await res.json()) as T;
  } catch (err) {
    // If backend is not running, caller will handle fallback
    throw err;
  }
}
