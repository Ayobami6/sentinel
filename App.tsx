
import React, { useState, useEffect } from 'react';
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
  ExternalLink
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { MOCK_SERVERS, MOCK_WEB_LOGS, MOCK_APP_LOGS } from './services/mockData';
import { ViewType, Server, WebLog, AppLog } from './types';
import { analyzeLogsWithAI } from './services/geminiService';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
      active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
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

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>('overview');
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  const handleAiAnalysis = async () => {
    setIsAiLoading(true);
    const report = await analyzeLogsWithAI([...MOCK_WEB_LOGS, ...MOCK_APP_LOGS]);
    setAiReport(report || "No analysis available.");
    setIsAiLoading(false);
  };

  const renderOverview = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Fleet Overview</h2>
          <p className="text-slate-400 text-sm mt-1">Direct monitoring of {MOCK_SERVERS.length} active nodes across your private network.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg border border-slate-700 transition-all text-sm font-medium">
            <RefreshCw size={16} />
            <span>Sync Agents</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Server Grid */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <ServerIcon size={18} className="text-blue-500" />
              Infrastructure Nodes
            </h3>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-full border border-slate-700/50">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Streaming</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {MOCK_SERVERS.map(server => {
              const latest = server.metrics[server.metrics.length - 1];
              return (
                <div 
                  key={server.id} 
                  className="group bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 hover:border-blue-500/50 hover:bg-slate-800/60 transition-all shadow-xl shadow-black/20"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${
                        server.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400' :
                        server.status === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-rose-500/10 text-rose-400'
                      }`}>
                        <ServerIcon size={24} />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{server.hostname}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-500 mono font-medium">{server.ip}</span>
                          <span className="text-slate-700">•</span>
                          <span className="text-xs text-slate-500 font-medium uppercase tracking-tighter">{server.os}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        server.status === 'healthy' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' :
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

                  {/* Individual Server Metrics Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MiniMetricCard label="CPU Usage" value={latest.cpu} unit="%" icon={Cpu} colorClass="text-blue-400" />
                    <MiniMetricCard label="Memory" value={latest.memory} unit="%" icon={Activity} colorClass="text-emerald-400" />
                    <MiniMetricCard label="Disk Space" value={latest.disk} unit="%" icon={Database} colorClass="text-amber-400" />
                    <MiniMetricCard label="Network" value={(latest.networkIn + latest.networkOut).toFixed(1)} unit="Mbps" icon={Zap} colorClass="text-purple-400" />
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-700/30 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-600"></div>
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Agent {server.agentVersion}</span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 italic">Last heartbeat: {new Date(server.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Info Panels */}
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-900/30 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Fleet Incidents
              </h3>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">LAST 24H</span>
            </div>
            <div className="p-5 space-y-5">
              {[
                { type: 'critical', msg: 'Disk capacity threshold on backup-node', time: '5m ago' },
                { type: 'warning', msg: 'Unusual spike in HTTP 500 on prod-api-01', time: '18m ago' },
                { type: 'info', msg: 'Agent re-authenticated on prod-db-master', time: '2h ago' },
              ].map((incident, i) => (
                <div key={i} className="flex gap-3 group">
                  <div className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                    incident.type === 'critical' ? 'bg-rose-500 ring-4 ring-rose-500/10' :
                    incident.type === 'warning' ? 'bg-amber-500 ring-4 ring-amber-500/10' :
                    'bg-blue-500 ring-4 ring-blue-500/10'
                  }`}></div>
                  <div>
                    <p className="text-xs text-slate-200 font-semibold leading-tight mb-1 group-hover:text-white transition-colors">{incident.msg}</p>
                    <span className="text-[10px] text-slate-500 font-mono">{incident.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full bg-slate-700/20 hover:bg-slate-700/40 text-slate-400 py-3 text-[10px] font-bold border-t border-slate-700 transition-colors uppercase tracking-widest">
              View Full History
            </button>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 via-blue-700 to-blue-800 rounded-2xl p-6 shadow-2xl shadow-blue-500/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Bot size={80} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md border border-white/20">
                  <Bot size={20} className="text-white" />
                </div>
                <h4 className="text-white font-bold tracking-tight">Sentinel Intelligent Analysis</h4>
              </div>
              <p className="text-blue-100 text-xs mb-6 leading-relaxed font-medium">
                Our models have parsed your recent logs and metrics. We've detected a recurring latency pattern affecting your database primary.
              </p>
              <button 
                onClick={handleAiAnalysis}
                className="w-full bg-white hover:bg-blue-50 text-blue-800 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {isAiLoading ? <RefreshCw className="animate-spin" size={16} /> : "Generate SRE Report"}
              </button>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Quick Shortcuts</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="p-3 bg-slate-900/50 hover:bg-slate-700 border border-slate-700/50 rounded-xl transition-all text-center">
                <Terminal size={18} className="mx-auto mb-2 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-300 block">SSH Console</span>
              </button>
              <button className="p-3 bg-slate-900/50 hover:bg-slate-700 border border-slate-700/50 rounded-xl transition-all text-center">
                <BarChart3 size={18} className="mx-auto mb-2 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-300 block">Reports</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLogs = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Log Explorer</h2>
          <p className="text-slate-400 text-sm">Centralized log management for all agents.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Filter logs (e.g. status:500 level:ERROR)..." 
              className="bg-slate-800 border border-slate-700 text-slate-200 pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-80"
            />
          </div>
          <button 
            onClick={handleAiAnalysis}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            {isAiLoading ? <RefreshCw className="animate-spin" size={16} /> : <Bot size={16} />}
            AI Debug
          </button>
        </div>
      </div>

      {aiReport && (
        <div className="bg-slate-800 border border-blue-500/30 p-4 rounded-xl relative">
          <button 
            onClick={() => setAiReport(null)}
            className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
          >
            ×
          </button>
          <div className="flex items-center gap-2 mb-3 text-blue-400 font-bold text-sm">
            <Bot size={16} />
            SENTINEL AI ANALYSIS
          </div>
          <div className="text-slate-300 text-sm prose prose-invert max-w-none whitespace-pre-line leading-relaxed">
            {aiReport}
          </div>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
        <div className="grid grid-cols-12 gap-2 p-3 border-b border-slate-700 bg-slate-900/50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
          <div className="col-span-2">Timestamp</div>
          <div className="col-span-1">Level</div>
          <div className="col-span-2">Service</div>
          <div className="col-span-7">Message</div>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {MOCK_APP_LOGS.map((log) => (
            <div key={log.id} className="grid grid-cols-12 gap-2 p-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
              <div className="col-span-2 text-slate-500 mono text-[11px]">
                {new Date(log.timestamp).toLocaleTimeString()}
              </div>
              <div className="col-span-1">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  log.level === 'ERROR' || log.level === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400' :
                  log.level === 'WARNING' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-blue-500/10 text-blue-400'
                }`}>
                  {log.level}
                </span>
              </div>
              <div className="col-span-2 text-slate-300 text-xs font-semibold">{log.service}</div>
              <div className="col-span-7 text-slate-400 text-xs truncate mono">{log.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderWebAnalytics = () => {
    const statusCounts = MOCK_WEB_LOGS.reduce((acc, log) => {
      const cat = Math.floor(log.status / 100) + 'xx';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const pieData = Object.keys(statusCounts).map(k => ({ name: k, value: statusCounts[k] }));

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Web Performance</h2>
            <p className="text-slate-400 text-sm">HTTP traffic insights parsed from Nginx/Apache logs.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-800 border border-slate-700 p-6 rounded-xl">
            <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
              <Activity size={18} className="text-blue-500" />
              Response Times (ms)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={MOCK_WEB_LOGS.slice(0, 20).reverse()}>
                  <defs>
                    <linearGradient id="colorRt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="timestamp" tickFormatter={(val) => new Date(val).toLocaleTimeString()} stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Area type="monotone" dataKey="responseTime" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRt)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
            <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-500" />
              HTTP Status Codes
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {pieData.map((d, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                  <span className="text-[10px] text-slate-400 font-bold">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
           <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/20">
             <h3 className="text-white font-bold text-sm">Endpoint Performance</h3>
           </div>
           <table className="w-full text-left text-xs">
             <thead>
               <tr className="bg-slate-900/50 text-slate-500 border-b border-slate-700">
                 <th className="p-3">Method</th>
                 <th className="p-3">Endpoint</th>
                 <th className="p-3">Avg Response</th>
                 <th className="p-3">Status</th>
                 <th className="p-3">Count</th>
               </tr>
             </thead>
             <tbody>
               {[
                 { m: 'POST', e: '/api/v1/billing/checkout', rt: '482ms', s: 200, c: 142 },
                 { m: 'GET', e: '/api/v2/users/reports', rt: '1,205ms', s: 200, c: 84 },
                 { m: 'POST', e: '/api/v1/auth/token', rt: '312ms', s: 401, c: 1042 },
               ].map((row, i) => (
                 <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                   <td className="p-3"><span className="font-bold text-blue-400">{row.m}</span></td>
                   <td className="p-3 text-slate-300 mono">{row.e}</td>
                   <td className="p-3 text-rose-400 font-medium">{row.rt}</td>
                   <td className="p-3">
                     <span className={`px-1.5 py-0.5 rounded font-bold ${row.s >= 400 ? 'text-rose-400 bg-rose-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                        {row.s}
                     </span>
                   </td>
                   <td className="p-3 text-slate-500 font-mono">{row.c}</td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      </div>
    );
  };

  const renderServerDetail = () => {
    if (!selectedServer) return null;
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveView('overview')}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg border border-slate-700 transition-colors"
          >
            <ChevronRight size={20} className="rotate-180" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white tracking-tight">{selectedServer.hostname}</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                selectedServer.status === 'healthy' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
                {selectedServer.status}
              </span>
            </div>
            <p className="text-slate-500 text-xs mono">Internal IP: {selectedServer.ip} • OS: {selectedServer.os}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
              <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
                <Cpu size={16} className="text-blue-400" />
                Resource Utilization (%)
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedServer.metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="timestamp" tickFormatter={(val) => new Date(val).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} unit="%" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
                    <Area type="monotone" dataKey="memory" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
              <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
                <Zap size={16} className="text-purple-400" />
                Network Traffic (Mbps)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedServer.metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="timestamp" tickFormatter={(val) => new Date(val).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="networkIn" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} strokeWidth={2} />
                    <Area type="monotone" dataKey="networkOut" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg shadow-black/30">
              <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                <Settings size={16} className="text-slate-400" />
                Node Properties
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Agent Version</span>
                  <span className="text-slate-200 mono">{selectedServer.agentVersion}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Ping Interval</span>
                  <span className="text-slate-200">10s</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Uptime</span>
                  <span className="text-emerald-400 font-bold">14d 2h 45m</span>
                </div>
                <button className="w-full mt-2 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold transition-colors">
                  Remote Reboot
                </button>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg shadow-black/30">
               <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                <Terminal size={16} className="text-slate-400" />
                Live Node Tail
              </h4>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 h-64 overflow-y-auto scrollbar-hide">
                <div className="space-y-2">
                  {MOCK_APP_LOGS.slice(0, 15).map((log, i) => (
                    <div key={i} className="text-[10px] leading-relaxed border-l border-slate-800 pl-2">
                      <span className="text-slate-600 font-mono">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                      <span className={log.level === 'ERROR' ? 'text-rose-500' : 'text-blue-500'}>{log.level}</span>{' '}
                      <span className="text-slate-400 mono">{log.message}</span>
                    </div>
                  ))}
                  <div className="flex gap-1 mt-2 items-center opacity-50">
                    <div className="h-1 w-1 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="h-1 w-1 bg-blue-500 rounded-full animate-bounce delay-75"></div>
                    <div className="h-1 w-1 bg-blue-500 rounded-full animate-bounce delay-150"></div>
                  </div>
                </div>
              </div>
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
        <h2 className="text-3xl font-bold text-white tracking-tight">Agent Deployment</h2>
        <p className="text-slate-400">Sentinel agents are compiled for high-performance monitoring on Unix environments.</p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-8 space-y-8">
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-600 text-xs font-bold flex items-center justify-center shadow-lg shadow-blue-500/30">1</span>
              Install the Go Agent
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">Fetch our private APT keys and install the daemon. Supported on Debian, Ubuntu, and RHEL.</p>
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-700 mono text-sm text-blue-400 shadow-inner">
              <div className="opacity-50"># Sentinel Observability v1.2.4</div>
              <div>curl -sL https://apt.sentinel.io/key.gpg | sudo apt-key add -</div>
              <div>echo "deb [arch=amd64] https://apt.sentinel.io/ sentinel main" | sudo tee /etc/apt/sources.list.d/sentinel.list</div>
              <div className="mt-2 opacity-50"># Update and Install</div>
              <div>sudo apt update && sudo apt install sentinel-agent -y</div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-600 text-xs font-bold flex items-center justify-center shadow-lg shadow-blue-500/30">2</span>
              Agent Configuration
            </h3>
            <p className="text-sm text-slate-400">Specify your telemetry endpoints and log paths in the YAML configuration.</p>
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-700 mono text-sm text-emerald-400 whitespace-pre shadow-inner">
{`server:
  api_key: "sn-prod-8349275982"
  endpoint: "https://api.sentinel.io"

metrics:
  interval: 60s
  collectors: [cpu, mem, disk, net, entropy]

logs:
  - path: "/var/log/nginx/access.log"
    type: "web"
    format: "combined"
  - path: "/opt/sentinel/logs/system.log"
    type: "app"`}
            </div>
          </section>
        </div>
        <div className="bg-slate-900/50 p-4 flex justify-between items-center border-t border-slate-700">
          <p className="text-xs text-slate-500">Problems installing? Contact the platform team via internal Slack.</p>
          <button className="text-blue-400 font-bold text-xs hover:text-blue-300 flex items-center gap-1 transition-colors">
            Full Docs <ExternalLink size={12} />
          </button>
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
      {/* Sidebar */}
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center gap-3 shadow-inner">
            <div className="h-10 w-10 bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-600 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white text-sm shadow-lg">
              ADM
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate leading-none mb-1">Root Admin</p>
              <p className="text-[10px] text-slate-500 truncate font-mono">admin-01@internal</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow ml-64 p-8 lg:p-12 bg-slate-950 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {getContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
