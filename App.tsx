
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Terminal,
  Activity,
  Settings,
  Server as ServerIcon,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Search,
  ChevronRight,
  RefreshCw,
  Cpu,
  Database,
  BarChart3,
  Bot,
  ExternalLink,
  Filter,
  Globe,
  Link as LinkIcon,
  Clock,
  TrendingUp,
  Timer
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, BarChart, Bar } from 'recharts';
import { MOCK_SERVERS, MOCK_WEB_LOGS, MOCK_APP_LOGS } from './services/mockData';
import { ViewType, Server, WebLog, AppLog, ServerMetric } from './types';
import { analyzeLogsWithAI } from './services/geminiService';
import { sentinelApi } from './services/apiService';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const MiniMetricCard = ({ label, value, unit, icon: Icon, colorClass }: { label: string, value: string | number, unit: string, icon: any, colorClass: string }) => (
  <div className="bg-slate-900/50 border border-slate-700/30 p-3 rounded-lg flex flex-col gap-1">
    <div className="flex items-center gap-2 text-slate-500">
      <Icon size={14} className={colorClass} />
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-lg font-bold text-slate-100">{value}</span>
      <span className="text-[9px] font-medium text-slate-500 uppercase">{unit}</span>
    </div>
  </div>
);

const ServerContextBar = ({ servers, selectedId, onSelect }: { servers: Server[], selectedId: string | 'all', onSelect: (id: string | 'all') => void }) => (
  <div className="flex items-center gap-2 p-1 bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-x-auto no-scrollbar">
    <button
      onClick={() => onSelect('all')}
      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${selectedId === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
    >
      All Infrastructure
    </button>
    {servers.map(s => (
      <button
        key={s.id}
        onClick={() => onSelect(s.id)}
        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${selectedId === s.id ? 'bg-slate-700 text-blue-400 border border-blue-500/30' : 'text-slate-500 hover:text-slate-300'}`}
      >
        <div className={`h-1.5 w-1.5 rounded-full ${s.status === 'healthy' ? 'bg-emerald-500' : s.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
        {s.hostname}
      </button>
    ))}
  </div>
);

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>('overview');
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);

  // Application Data State
  const [servers, setServers] = useState<Server[]>(MOCK_SERVERS);
  const [webLogs, setWebLogs] = useState<WebLog[]>(MOCK_WEB_LOGS);
  const [appLogs, setAppLogs] = useState<AppLog[]>(MOCK_APP_LOGS);

  const [serverMetrics, setServerMetrics] = useState<ServerMetric[]>([]);
  const [serverFilter, setServerFilter] = useState<string | 'all'>('all');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync with API
  const syncWithApi = useCallback(async () => {
    try {
      const isUp = await sentinelApi.checkHealth();
      setBackendOnline(isUp);

      if (isUp) {
        const [apiServers, apiAppLogs, apiWebLogs] = await Promise.all([
          sentinelApi.getServers(),
          sentinelApi.getAppLogs(),
          sentinelApi.getWebLogs()
        ]);

        // Merge latest metrics into servers list if missing
        const serversWithLatestMetrics = await Promise.all(apiServers.map(async (s) => {
          const metrics = await sentinelApi.getServerMetrics(s.id);
          return { ...s, metrics };
        }));

        setServers(serversWithLatestMetrics);
        setAppLogs(apiAppLogs);
        setWebLogs(apiWebLogs);
      } else {
        // Revert to mock if backend drops
        setServers(MOCK_SERVERS);
        setAppLogs(MOCK_APP_LOGS);
        setWebLogs(MOCK_WEB_LOGS);
      }
      setLastRefreshed(new Date());
    } catch (e) {
      console.error("Sync failed", e);
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    syncWithApi();
    const interval = setInterval(syncWithApi, 10000);
    return () => clearInterval(interval);
  }, [syncWithApi]);

  // Fetch or simulate metrics for Server Detail
  const refreshDetailData = useCallback(async () => {
    if (!selectedServer) return;

    setIsRefreshing(true);
    try {
      if (backendOnline) {
        const metrics = await sentinelApi.getServerMetrics(selectedServer.id);
        if (metrics.length > 0) {
          setServerMetrics(metrics);
        } else {
          setServerMetrics(selectedServer.metrics);
        }
      } else {
        setServerMetrics(prev => {
          const last = prev[prev.length - 1] || { cpu: 20, memory: 40, disk: 65, networkIn: 100, networkOut: 50 };
          const next = {
            timestamp: new Date().toISOString(),
            cpu: Math.max(10, Math.min(95, last.cpu + (Math.random() * 10 - 5))),
            memory: Math.max(20, Math.min(90, last.memory + (Math.random() * 6 - 3))),
            disk: last.disk,
            networkIn: Math.floor(Math.random() * 500) + 100,
            networkOut: Math.floor(Math.random() * 300) + 50,
          };
          return [...prev.slice(-29), next];
        });
      }
      setLastRefreshed(new Date());
    } catch (e) {
      console.error("Failed to refresh detail data", e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  }, [selectedServer, backendOnline]);

  useEffect(() => {
    if (selectedServer) {
      setServerMetrics(selectedServer.metrics);
      refreshDetailData();
    }
  }, [selectedServer, refreshDetailData]);

  useEffect(() => {
    if (activeView === 'server-detail' && selectedServer) {
      const interval = setInterval(() => {
        refreshDetailData();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [activeView, selectedServer, refreshDetailData]);

  const filteredAppLogs = useMemo(() =>
    serverFilter === 'all' ? appLogs : appLogs.filter(l => l.serverId === serverFilter),
    [serverFilter, appLogs]);

  const filteredWebLogs = useMemo(() =>
    serverFilter === 'all' ? webLogs : webLogs.filter(l => l.serverId === serverFilter),
    [serverFilter, webLogs]);

  const rpsData = useMemo(() => {
    const buckets: Record<string, number> = {};
    const windowSeconds = 10;
    filteredWebLogs.forEach(log => {
      const date = new Date(log.timestamp);
      date.setSeconds(Math.floor(date.getSeconds() / windowSeconds) * windowSeconds);
      date.setMilliseconds(0);
      const key = date.toISOString();
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets)
      .map(([timestamp, count]) => ({
        timestamp,
        rps: parseFloat((count / windowSeconds).toFixed(2))
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [filteredWebLogs]);

  const latencyData = useMemo(() => {
    const buckets: Record<string, { sum: number, count: number }> = {};
    const windowSeconds = 30;
    filteredWebLogs.forEach(log => {
      const date = new Date(log.timestamp);
      date.setSeconds(Math.floor(date.getSeconds() / windowSeconds) * windowSeconds);
      date.setMilliseconds(0);
      const key = date.toISOString();
      if (!buckets[key]) buckets[key] = { sum: 0, count: 0 };
      buckets[key].sum += log.responseTime;
      buckets[key].count += 1;
    });
    return Object.entries(buckets)
      .map(([timestamp, data]) => ({
        timestamp,
        latency: Math.round(data.sum / data.count)
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [filteredWebLogs]);

  const endpointStats = useMemo(() => {
    const stats: Record<string, { sum: number, count: number }> = {};
    filteredWebLogs.forEach(log => {
      if (!stats[log.path]) stats[log.path] = { sum: 0, count: 0 };
      stats[log.path].sum += log.responseTime;
      stats[log.path].count += 1;
    });
    return Object.entries(stats)
      .map(([path, data]) => ({
        path,
        avgLatency: Math.round(data.sum / data.count),
        count: data.count
      }))
      .sort((a, b) => b.avgLatency - a.avgLatency)
      .slice(0, 5);
  }, [filteredWebLogs]);

  useEffect(() => {
    setAiReport(null);
  }, [serverFilter, activeView]);

  const handleAiAnalysis = async () => {
    setIsAiLoading(true);
    const contextStr = serverFilter === 'all'
      ? 'All Servers'
      : `Server: ${servers.find(s => s.id === serverFilter)?.hostname || 'Unknown'}`;
    const report = await analyzeLogsWithAI([...filteredWebLogs, ...filteredAppLogs], contextStr);
    setAiReport(report || "No analysis available.");
    setIsAiLoading(false);
  };

  const renderOverview = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Fleet Overview</h2>
          <p className="text-slate-400 text-sm mt-1">Direct monitoring of {servers.length} active nodes across your network.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={syncWithApi}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg border border-slate-700 transition-all text-sm font-medium"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync Fleet</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <ServerIcon size={18} className="text-blue-500" />
              Infrastructure Nodes
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {servers.map(server => {
              const latest = server.metrics?.[server.metrics.length - 1] || { cpu: 0, memory: 0, disk: 0, networkIn: 0, networkOut: 0 };
              return (
                <div
                  key={server.id}
                  className="group bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 hover:border-blue-500/50 hover:bg-slate-800/60 transition-all shadow-xl shadow-black/20"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${server.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400' :
                          server.status === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-rose-500/10 text-rose-400'
                        }`}>
                        <ServerIcon size={24} />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{server.hostname}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-500 mono font-medium">{server.ip}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${server.status === 'healthy' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' :
                          server.status === 'warning' ? 'bg-amber-500/5 border-amber-500/20 text-amber-400' :
                            'bg-rose-500/5 border-rose-500/20 text-rose-400'
                        }`}>
                        {server.status}
                      </div>
                      <button
                        onClick={() => { setSelectedServer(server); setActiveView('server-detail'); }}
                        className="p-2 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                      >
                        <ExternalLink size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MiniMetricCard label="CPU Usage" value={latest.cpu.toFixed(1)} unit="%" icon={Cpu} colorClass="text-blue-400" />
                    <MiniMetricCard label="Memory" value={latest.memory.toFixed(1)} unit="%" icon={Activity} colorClass="text-emerald-400" />
                    <MiniMetricCard label="Disk Space" value={latest.disk.toFixed(2)} unit="%" icon={Database} colorClass="text-amber-400" />
                    <MiniMetricCard label="Network" value={(latest.networkIn + latest.networkOut).toFixed(1)} unit="Mbps" icon={Zap} colorClass="text-purple-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-900/30 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Fleet Incidents
              </h3>
            </div>
            <div className="p-5 space-y-5">
              {[
                { type: 'critical', msg: 'Disk capacity threshold on backup-node', time: '5m ago' },
                { type: 'warning', msg: 'Unusual spike in HTTP 500 on prod-api-01', time: '18m ago' },
              ].map((incident, i) => (
                <div key={i} className="flex gap-3 group">
                  <div className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${incident.type === 'critical' ? 'bg-rose-500 ring-4 ring-rose-500/10' : 'bg-amber-500 ring-4 ring-amber-500/10'
                    }`}></div>
                  <div>
                    <p className="text-xs text-slate-200 font-semibold leading-tight mb-1">{incident.msg}</p>
                    <span className="text-[10px] text-slate-500 font-mono">{incident.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gradient-to-br from-indigo-600 to-blue-800 rounded-2xl p-6 shadow-2xl shadow-blue-500/20">
            <div className="flex items-center gap-3 mb-4 text-white">
              <Bot size={22} />
              <h4 className="font-bold">Sentinel AI</h4>
            </div>
            <p className="text-blue-100 text-xs mb-6 font-medium leading-relaxed">
              Analyze current log streams to identify root causes and patterns across your fleet.
            </p>
            <button
              onClick={handleAiAnalysis}
              className="w-full bg-white hover:bg-blue-50 text-blue-800 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {isAiLoading ? <RefreshCw className="animate-spin" size={16} /> : "Run AI Health Check"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLogs = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Log Explorer</h2>
            <p className="text-slate-400 text-sm">Server-scoped centralized log streaming.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Search messages..."
                className="bg-slate-800 border border-slate-700 text-slate-200 pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
              />
            </div>
            <button
              onClick={handleAiAnalysis}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
            >
              {isAiLoading ? <RefreshCw className="animate-spin" size={16} /> : <Bot size={16} />}
              AI Analyze {serverFilter === 'all' ? 'All' : 'Server'}
            </button>
          </div>
        </div>
        <ServerContextBar servers={servers} selectedId={serverFilter} onSelect={setServerFilter} />
      </div>

      {aiReport && (
        <div className="bg-slate-800 border border-blue-500/30 p-5 rounded-xl relative shadow-2xl animate-in zoom-in-95 duration-200">
          <button onClick={() => setAiReport(null)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-700 rounded-lg transition-colors">×</button>
          <div className="flex items-center gap-2 mb-4 text-blue-400 font-bold text-sm">
            <Bot size={18} />
            <span className="tracking-wide uppercase">Sentinel AI Analysis</span>
            <span className="text-slate-500 font-medium normal-case ml-1">— {serverFilter === 'all' ? 'Fleet-wide' : servers.find(s => s.id === serverFilter)?.hostname}</span>
          </div>
          <div className="text-slate-300 text-sm prose prose-invert max-w-none whitespace-pre-line leading-relaxed">
            {aiReport}
          </div>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
        <div className="grid grid-cols-12 gap-2 p-3 border-b border-slate-700 bg-slate-900/50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
          <div className="col-span-2">Timestamp</div>
          <div className="col-span-2">Server</div>
          <div className="col-span-1">Level</div>
          <div className="col-span-7">Message</div>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {filteredAppLogs.length > 0 ? filteredAppLogs.map((log) => {
            const server = servers.find(s => s.id === log.serverId);
            return (
              <div key={log.id} className="grid grid-cols-12 gap-2 p-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <div className="col-span-2 text-slate-500 mono text-[11px]">{new Date(log.timestamp).toLocaleTimeString()}</div>
                <div className="col-span-2 text-blue-400/80 text-[11px] font-bold truncate">{server?.hostname || 'Unknown'}</div>
                <div className="col-span-1">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${log.level === 'ERROR' || log.level === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>{log.level}</span>
                </div>
                <div className="col-span-7 text-slate-400 text-xs truncate mono">{log.message}</div>
              </div>
            );
          }) : (
            <div className="p-12 text-center text-slate-500">No logs found for the selected filter.</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderWebAnalytics = () => {
    const statusCounts = filteredWebLogs.reduce((acc, log) => {
      const cat = Math.floor(log.status / 100) + 'xx';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const pieData = Object.keys(statusCounts).map(k => ({ name: k, value: statusCounts[k] }));

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Web Insights</h2>
            <p className="text-slate-400 text-sm">HTTP metrics analyzed from web server access logs.</p>
          </div>
          <ServerContextBar servers={servers} selectedId={serverFilter} onSelect={setServerFilter} />
        </div>

        {filteredWebLogs.length > 0 ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-800 border border-slate-700 p-6 rounded-xl">
                <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
                  <TrendingUp size={18} className="text-emerald-500" />
                  Requests Per Second (RPS)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rpsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => new Date(val).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })} stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} label={{ value: 'req/s', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} labelFormatter={(label) => new Date(label).toLocaleTimeString()} />
                      <Bar dataKey="rps" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
                <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
                  <BarChart3 size={18} className="text-blue-500" />
                  Status Codes
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {pieData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-2 bg-slate-800 border border-slate-700 p-6 rounded-xl">
                <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
                  <Timer size={18} className="text-blue-400" />
                  Average Response Time (ms)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={latencyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} unit="ms" />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} labelFormatter={(label) => new Date(label).toLocaleTimeString()} />
                      <Area type="monotone" dataKey="latency" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
                <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
                  <Zap size={18} className="text-rose-400" />
                  Top Slowest Paths
                </h3>
                <div className="space-y-4">
                  {endpointStats.map((stat, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300 font-mono truncate max-w-[140px]">{stat.path}</span>
                        <span className="text-rose-400 font-bold">{stat.avgLatency}ms</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5">
                        <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (stat.avgLatency / 500) * 100)}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-700 bg-slate-900/20">
                <h3 className="text-white font-bold text-sm">Real-time Web Events</h3>
              </div>
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-900/50 text-slate-500 border-b border-slate-700 font-bold uppercase tracking-wider">
                    <th className="p-3">Time</th>
                    <th className="p-3">Server</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Endpoint</th>
                    <th className="p-3">Latency</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWebLogs.slice(0, 15).map((row, i) => {
                    const server = servers.find(s => s.id === row.serverId);
                    return (
                      <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                        <td className="p-3 text-slate-500">{new Date(row.timestamp).toLocaleTimeString()}</td>
                        <td className="p-3 text-blue-400 font-bold">{server?.hostname}</td>
                        <td className="p-3 text-slate-300">{row.method}</td>
                        <td className="p-3 text-slate-400 mono">{row.path}</td>
                        <td className="p-3 font-medium text-slate-200">{row.responseTime}ms</td>
                        <td className="p-3">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${row.status >= 400 ? 'text-rose-400 bg-rose-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="p-24 text-center text-slate-500 bg-slate-800/50 border border-slate-700 rounded-2xl">
            No web traffic recorded on this node.
          </div>
        )}
      </div>
    );
  };

  const renderServerDetail = () => {
    if (!selectedServer) return null;
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveView('overview')} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg border border-slate-700 transition-colors">
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white tracking-tight">{selectedServer.hostname}</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${selectedServer.status === 'healthy' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}>{selectedServer.status}</span>
              </div>
              <p className="text-slate-500 text-xs mono">Internal IP: {selectedServer.ip} • OS: {selectedServer.os}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-slate-900/50 p-2 pr-4 rounded-xl border border-slate-800 self-start md:self-center">
            <div className={`p-2 rounded-lg ${isRefreshing ? 'bg-blue-600/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Auto-Refresh (15s)</span>
              <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                <Clock size={10} /> Last update: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
              <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
                <Cpu size={16} className="text-blue-400" /> Resource Utilization (%)
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serverMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="timestamp" tickFormatter={(val) => new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} unit="%" domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} animationDuration={1000} />
                    <Area type="monotone" dataKey="memory" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} animationDuration={1000} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h4 className="text-white font-bold mb-4 flex items-center gap-2"><Terminal size={16} className="text-slate-400" /> Node Activity</h4>
            <div className="space-y-4">
              {appLogs.filter(l => l.serverId === selectedServer.id).slice(0, 10).map((log, i) => (
                <div key={i} className="text-[10px] border-l border-slate-700 pl-3 py-1">
                  <p className="text-slate-500 font-mono mb-0.5">{new Date(log.timestamp).toLocaleTimeString()}</p>
                  <p className="text-slate-200 line-clamp-1">{log.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderConfig = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-4 bg-blue-500/10 rounded-2xl mb-2">
          <Settings size={40} className="text-blue-500" />
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Deployment & Integration</h2>
        <p className="text-slate-400">Manage your Sentinel Agent fleet and API endpoints.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <LinkIcon size={20} className="text-blue-400" /> API Schema
          </h3>
          <div className="space-y-3">
            {[
              { path: '/v1/ingest/metrics', m: 'POST', desc: 'System health data' },
              { path: '/v1/ingest/logs/web', m: 'POST', desc: 'Web server logs' },
              { path: '/v1/query/logs/web', m: 'GET', desc: 'Fetch web log history' },
              { path: '/v1/query/servers', m: 'GET', desc: 'Fleet inventory' },
            ].map((route, i) => (
              <div key={i} className="flex flex-col gap-1 p-3 bg-slate-950 rounded-xl border border-slate-700/50">
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 tracking-widest">{route.m}</span>
                  <span className="text-[10px] text-slate-500 mono">{route.path}</span>
                </div>
                <p className="text-[11px] text-slate-400">{route.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <ServerIcon size={20} className="text-indigo-400" /> Agent Configuration
          </h3>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-700 mono text-[11px] text-blue-400 space-y-1">
            <div className="text-slate-600"># sentinel-agent.yaml</div>
            <div>server_id: "prod-api-01"</div>
            <div>backend_url: "http://sentinel-hub:8000"</div>
            <div>poll_interval: "15s"</div>
          </div>
          <p className="mt-4 text-xs text-slate-500 leading-relaxed">Ensure agents have network visibility to the FastAPI hub on port 8000.</p>
        </div>
      </div>
    </div>
  );

  const getContent = () => {
    switch (activeView) {
      case 'overview': return renderOverview();
      case 'logs': return renderLogs();
      case 'web-analytics': return renderWebAnalytics();
      case 'server-detail': return renderServerDetail();
      case 'config': return renderConfig();
      default: return renderOverview();
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      <aside className="w-64 border-r border-slate-800 flex flex-col fixed h-full bg-slate-950 z-20 shadow-2xl">
        <div className="p-6 flex items-center gap-3">
          <div className="h-9 w-9 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <ShieldCheck className="text-white" size={22} />
          </div>
          <h1 className="text-xl font-black text-white tracking-tighter uppercase">Sentinel</h1>
        </div>

        <nav className="flex-grow px-4 space-y-1.5 mt-4">
          <SidebarItem icon={LayoutDashboard} label="Fleet Dashboard" active={activeView === 'overview' || activeView === 'server-detail'} onClick={() => setActiveView('overview')} />
          <SidebarItem icon={Terminal} label="Log Explorer" active={activeView === 'logs'} onClick={() => setActiveView('logs')} />
          <SidebarItem icon={Activity} label="Web Insights" active={activeView === 'web-analytics'} onClick={() => setActiveView('web-analytics')} />
          <SidebarItem icon={Settings} label="Deployment" active={activeView === 'config'} onClick={() => setActiveView('config')} />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="mb-4 px-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              <span>Ingest Engine</span>
              <div className={`h-2 w-2 rounded-full ${backendOnline ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-rose-500'}`}></div>
            </div>
            <div className="text-[10px] mono text-slate-600">{backendOnline ? 'ONLINE' : 'MOCK MODE'}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white text-sm shadow-lg">ADM</div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate leading-none mb-1">Root Admin</p>
              <p className="text-[10px] text-slate-500 truncate font-mono">admin-01@internal</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-grow ml-64 p-8 lg:p-12 bg-slate-950 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {getContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
