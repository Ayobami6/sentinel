
export interface ServerMetric {
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
  networkIn: number;
  networkOut: number;
}

export interface WebLog {
  id: string;
  serverId: string; // Added for server-based filtering
  timestamp: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  status: number;
  responseTime: number;
  ip: string;
  userAgent: string;
  severity: 'info' | 'warn' | 'error';
}

export interface AppLog {
  id: string;
  serverId: string; // Added for server-based filtering
  timestamp: string;
  service: string;
  message: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  metadata?: Record<string, any>;
}

export interface Server {
  id: string;
  hostname: string;
  ip: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  metrics: ServerMetric[];
  os: string;
  agentVersion: string;
  lastSeen: string;
}

export type ViewType = 'overview' | 'server-detail' | 'logs' | 'web-analytics' | 'config';
