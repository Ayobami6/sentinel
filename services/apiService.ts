
import { Server, WebLog, AppLog, ServerMetric } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const sentinelApi = {
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },

  async getServers(): Promise<Server[]> {
    const res = await fetch(`${API_BASE}/query/servers`);
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
    const res = await fetch(url);
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
    const res = await fetch(url);
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
    const res = await fetch(`${API_BASE}/query/metrics/${serverId}`);
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
    return fetch(`${API_BASE}/ingest/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metric)
    });
  }
};
