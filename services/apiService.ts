
import { Server, WebLog, AppLog, ServerMetric } from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/v1';

// --- Auth injection for sentinelApi ---

let _getToken: (() => string | null) | null = null;
let _onLogout: (() => void) | null = null;

/** Called by AuthProvider on mount to wire up token getter and logout callback. */
export function setSentinelApiAuth(
  getToken: () => string | null,
  onLogout: () => void,
): void {
  _getToken = getToken;
  _onLogout = onLogout;
}

// Mutex: a pending refresh promise shared across concurrent callers.
let refreshMutex: Promise<string> | null = null;

async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = _getToken?.() ?? null;

  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res = await fetch(input, { ...init, headers });

  if (res.status !== 401) {
    return res;
  }

  // 401 — attempt a single token refresh, serialised via mutex.
  if (!refreshMutex) {
    refreshMutex = authApi.refresh().then((r) => r.access_token).finally(() => {
      refreshMutex = null;
    });
  }

  let newToken: string;
  try {
    newToken = await refreshMutex;
  } catch (err) {
    _onLogout?.();
    throw err;
  }

  // Retry original request with the new token.
  const retryHeaders = new Headers(init.headers);
  retryHeaders.set('Authorization', `Bearer ${newToken}`);
  res = await fetch(input, { ...init, headers: retryHeaders });
  return res;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export const authApi = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? res.statusText);
    }
    return res.json();
  },

  async refresh(): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? res.statusText);
    }
    return res.json();
  },

  async logout(): Promise<void> {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? res.statusText);
    }
  },
};

export const sentinelApi = {
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },

  async getServers(): Promise<Server[]> {
    const res = await fetchWithAuth(`${API_BASE}/query/servers`);
    if (!res.ok) throw new Error('Failed to fetch servers');
    const data = await res.json();
    return data.map((s: any) => ({
      ...s,
      lastSeen: new Date().toISOString(),
      metrics: [], // Metrics are fetched separately per server detail usually
    }));
  },

  async getAppLogs(serverId?: string): Promise<AppLog[]> {
    const url = serverId && serverId !== 'all'
      ? `${API_BASE}/query/logs/app?server_id=${serverId}`
      : `${API_BASE}/query/logs/app`;
    const res = await fetchWithAuth(url);
    if (!res.ok) throw new Error('Failed to fetch app logs');
    const data = await res.json();
    return data.map((l: any) => ({
      ...l,
      serverId: l.server_id,
    }));
  },

  async getWebLogs(serverId?: string): Promise<WebLog[]> {
    const url = serverId && serverId !== 'all'
      ? `${API_BASE}/query/logs/web?server_id=${serverId}`
      : `${API_BASE}/query/logs/web`;
    const res = await fetchWithAuth(url);
    if (!res.ok) throw new Error('Failed to fetch web logs');
    const data = await res.json();
    return data.map((l: any) => ({
      ...l,
      serverId: l.server_id,
      responseTime: l.response_time,
      userAgent: l.user_agent,
      severity: l.status >= 500 ? 'error' : l.status >= 400 ? 'warn' : 'info'
    }));
  },

  async getServerMetrics(serverId: string): Promise<ServerMetric[]> {
    const res = await fetchWithAuth(`${API_BASE}/query/metrics/${serverId}`);
    if (!res.ok) throw new Error('Failed to fetch metrics');
    const data = await res.json();
    return data.map((m: any) => ({
      timestamp: m.timestamp,
      cpu: m.cpu,
      memory: m.memory,
      disk: m.disk,
      networkIn: m.network_in,
      networkOut: m.network_out
    }));
  },

  async ingestMetric(metric: Partial<ServerMetric> & { server_id: string }) {
    return fetchWithAuth(`${API_BASE}/ingest/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metric)
    });
  }
};
