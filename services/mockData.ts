
import { Server, ServerMetric, WebLog, AppLog } from '../types';

const generateMetrics = (count: number): ServerMetric[] => {
  return Array.from({ length: count }).map((_, i) => ({
    timestamp: new Date(Date.now() - (count - i) * 60000).toISOString(),
    cpu: Math.floor(Math.random() * 40) + 10,
    memory: Math.floor(Math.random() * 30) + 40,
    disk: 65,
    networkIn: Math.floor(Math.random() * 500) + 100,
    networkOut: Math.floor(Math.random() * 300) + 50,
  }));
};

export const MOCK_SERVERS: Server[] = [
  {
    id: 'srv-01',
    hostname: 'prod-api-01',
    ip: '10.0.1.45',
    status: 'healthy',
    os: 'Ubuntu 22.04 LTS',
    agentVersion: 'v1.2.4',
    lastSeen: new Date().toISOString(),
    metrics: generateMetrics(30),
  },
  {
    id: 'srv-02',
    hostname: 'prod-db-master',
    ip: '10.0.1.52',
    status: 'warning',
    os: 'Debian 11',
    agentVersion: 'v1.2.4',
    lastSeen: new Date().toISOString(),
    metrics: generateMetrics(30).map(m => ({ ...m, cpu: m.cpu + 40 })),
  },
  {
    id: 'srv-03',
    hostname: 'staging-web-01',
    ip: '10.0.5.11',
    status: 'healthy',
    os: 'Ubuntu 22.04 LTS',
    agentVersion: 'v1.2.3',
    lastSeen: new Date().toISOString(),
    metrics: generateMetrics(30),
  },
  {
    id: 'srv-04',
    hostname: 'backup-node',
    ip: '10.0.2.19',
    status: 'critical',
    os: 'RedHat Enterprise Linux 9',
    agentVersion: 'v1.2.0',
    lastSeen: new Date(Date.now() - 300000).toISOString(),
    metrics: generateMetrics(30).map(m => ({ ...m, disk: 98, cpu: 95 })),
  }
];

export const MOCK_WEB_LOGS: WebLog[] = Array.from({ length: 50 }).map((_, i) => {
  const paths = ['/api/v1/auth', '/api/v2/users', '/static/logo.png', '/api/v1/billing', '/health'];
  const statusCodes = [200, 200, 201, 200, 404, 500, 301, 200, 200, 200];
  const statusCode = statusCodes[Math.floor(Math.random() * statusCodes.length)];
  return {
    id: `wlog-${i}`,
    timestamp: new Date(Date.now() - i * 15000).toISOString(),
    method: Math.random() > 0.8 ? 'POST' : 'GET',
    path: paths[Math.floor(Math.random() * paths.length)],
    status: statusCode,
    responseTime: Math.floor(Math.random() * 400) + 50,
    ip: `192.168.1.${Math.floor(Math.random() * 254)}`,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
    severity: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
  };
});

export const MOCK_APP_LOGS: AppLog[] = Array.from({ length: 50 }).map((_, i) => {
  const levels: AppLog['level'][] = ['INFO', 'INFO', 'DEBUG', 'WARNING', 'ERROR'];
  const level = levels[Math.floor(Math.random() * levels.length)];
  const messages = [
    'Connection to redis pool successful',
    'Processing job-123984',
    'User login detected',
    'Database query took too long (350ms)',
    'Failed to send email notification to user@example.com',
    'Starting worker process #4'
  ];
  return {
    id: `alog-${i}`,
    timestamp: new Date(Date.now() - i * 20000).toISOString(),
    service: Math.random() > 0.5 ? 'auth-service' : 'order-processor',
    level,
    message: messages[Math.floor(Math.random() * messages.length)],
  };
});
