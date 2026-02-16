
import { Server, WebLog, AppLog, ServerMetric } from '../types';

const API_BASE = 'http://localhost:8000';

export const sentinelApi = {
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },

  async getServers(): Promise<Record<string, any>> {
    const res = await fetch(`${API_BASE}/query/servers`);
    if (!res.ok) throw new Error('Failed to fetch servers');
    return res.json();
  },

  async getAppLogs(serverId?: string): Promise<AppLog[]> {
    const url = serverId 
      ? `${API_BASE}/query/logs/app?server_id=${serverId}`
      : `${API_BASE}/query/logs/app`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json();
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
