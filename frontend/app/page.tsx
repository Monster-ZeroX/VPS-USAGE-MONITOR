'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Network, 
  Server, 
  Wifi,
  Clock,
  TrendingUp,
  TrendingDown,
  Globe,
  Users,
  RefreshCw,
  Zap
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

interface SystemStats {
  timestamp: string;
  cpu: {
    overall: number;
    per_core: number[];
    cores: number;
    load_avg: number[];
  };
  memory: {
    total: number;
    used: number;
    available: number;
    percent: number;
    swap: {
      total: number;
      used: number;
      percent: number;
    };
  };
  network: {
    bytes_sent: number;
    bytes_recv: number;
    bytes_sent_rate: number;
    bytes_recv_rate: number;
    interfaces: Record<string, any>;
  };
  ip_traffic: Array<{
    ip: string;
    bytes_in: number;
    bytes_out: number;
    connections: number;
    urls: string[];
  }>;
  processes: Array<{
    pid: number;
    name: string;
    cpu_percent: number;
    memory_percent: number;
  }>;
}

interface HistoryPoint {
  time: string;
  cpu: number;
  memory: number;
  networkIn: number;
  networkOut: number;
}

const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatBytesRate = (bytes: number): string => {
  return formatBytes(bytes) + '/s';
};

export default function Home() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'network' | 'processes'>('overview');
  const [error, setError] = useState<string | null>(null);

  const connectWebSocket = useCallback(() => {
    // Dynamically determine WebSocket URL based on current browser location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `${protocol}//${host}:3001`;
    const ws = new WebSocket(`${wsUrl}/ws`);

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data: SystemStats = JSON.parse(event.data);
        setStats(data);
        
        // Add to history
        setHistory(prev => {
          const newPoint: HistoryPoint = {
            time: new Date().toLocaleTimeString(),
            cpu: data.cpu.overall,
            memory: data.memory.percent,
            networkIn: data.network.bytes_recv_rate,
            networkOut: data.network.bytes_sent_rate,
          };
          const updated = [...prev, newPoint].slice(-60); // Keep last 60 seconds
          return updated;
        });
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('WebSocket disconnected, reconnecting...');
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (e) => {
      setError('Connection failed. Make sure the backend is running.');
      console.error('WebSocket error:', e);
    };

    return ws;
  }, []);

  useEffect(() => {
    const ws = connectWebSocket();
    return () => ws.close();
  }, [connectWebSocket]);

  const StatCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    color = 'primary',
    trend 
  }: { 
    title: string; 
    value: string; 
    subtitle?: string; 
    icon: any;
    color?: 'primary' | 'accent' | 'blue' | 'purple';
    trend?: 'up' | 'down';
  }) => {
    const colorClasses = {
      primary: 'from-primary-500 to-primary-600',
      accent: 'from-accent-500 to-accent-600',
      blue: 'from-blue-500 to-blue-600',
      purple: 'from-purple-500 to-purple-600',
    };

    return (
      <div className="glass rounded-2xl p-6 card-hover">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-sm ${trend === 'up' ? 'text-red-500' : 'text-green-500'}`}>
              {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          )}
        </div>
        <h3 className="text-slate-500 text-sm font-medium mb-1">{title}</h3>
        <p className="text-3xl font-bold text-slate-800">{value}</p>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
    );
  };

  const ProgressBar = ({ 
    value, 
    max = 100, 
    color = 'primary',
    showLabel = true 
  }: { 
    value: number; 
    max?: number; 
    color?: string;
    showLabel?: boolean;
  }) => {
    const percentage = Math.min((value / max) * 100, 100);
    const colorClass = percentage > 80 ? 'bg-red-500' : percentage > 60 ? 'bg-yellow-500' : 'bg-primary-500';
    
    return (
      <div className="w-full">
        <div className="flex justify-between mb-1">
          {showLabel && <span className="text-sm text-slate-500">{value.toFixed(1)}%</span>}
        </div>
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ease-out ${colorClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  if (error && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="glass rounded-3xl p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Wifi className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Connection Error</h2>
          <p className="text-slate-500 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold gradient-text mb-2">VPS Monitor</h1>
            <p className="text-slate-500">Real-time system performance dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${connected ? 'bg-primary-100 text-primary-700' : 'bg-red-100 text-red-700'}`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-primary-500 pulse-glow' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">{connected ? 'Live' : 'Disconnected'}</span>
            </div>
            {stats && (
              <div className="flex items-center gap-2 text-slate-500">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{new Date(stats.timestamp).toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="mb-8">
        <div className="glass rounded-2xl p-1.5 inline-flex gap-1">
          {(['overview', 'network', 'processes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-white/50'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </nav>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="CPU Usage"
              value={`${stats.cpu.overall.toFixed(1)}%`}
              subtitle={`${stats.cpu.cores} cores`}
              icon={Cpu}
              color="primary"
            />
            <StatCard
              title="Memory Usage"
              value={`${stats.memory.percent.toFixed(1)}%`}
              subtitle={`${formatBytes(stats.memory.used)} / ${formatBytes(stats.memory.total)}`}
              icon={HardDrive}
              color="accent"
            />
            <StatCard
              title="Network In"
              value={formatBytesRate(stats.network.bytes_recv_rate)}
              subtitle={`Total: ${formatBytes(stats.network.bytes_recv)}`}
              icon={TrendingDown}
              color="blue"
            />
            <StatCard
              title="Network Out"
              value={formatBytesRate(stats.network.bytes_sent_rate)}
              subtitle={`Total: ${formatBytes(stats.network.bytes_sent)}`}
              icon={TrendingUp}
              color="purple"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CPU & Memory Chart */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-500" />
                CPU & Memory History
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                      }} 
                    />
                    <Area type="monotone" dataKey="cpu" stroke="#22c55e" fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
                    <Area type="monotone" dataKey="memory" stroke="#10b981" fillOpacity={1} fill="url(#colorMemory)" name="Memory %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Network Chart */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Network className="w-5 h-5 text-primary-500" />
                Network Traffic
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => formatBytes(v)} />
                    <Tooltip 
                      formatter={(value: number) => formatBytesRate(value)}
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                      }} 
                    />
                    <Line type="monotone" dataKey="networkIn" stroke="#3b82f6" strokeWidth={2} dot={false} name="Download" />
                    <Line type="monotone" dataKey="networkOut" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Upload" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Per-Core CPU */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary-500" />
              CPU Cores
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {stats.cpu.per_core.map((usage, index) => (
                <div key={index} className="text-center">
                  <div className="text-sm text-slate-500 mb-2">Core {index}</div>
                  <div className="relative w-16 h-16 mx-auto">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="#e2e8f0"
                        strokeWidth="6"
                        fill="none"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke={usage > 80 ? '#ef4444' : usage > 60 ? '#eab308' : '#22c55e'}
                        strokeWidth="6"
                        fill="none"
                        strokeDasharray={`${usage * 1.76} 176`}
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-semibold text-slate-700">{usage.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Network Tab */}
      {activeTab === 'network' && stats && (
        <div className="space-y-6">
          {/* Network Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Active Connections"
              value={stats.ip_traffic.reduce((acc, ip) => acc + ip.connections, 0).toString()}
              icon={Users}
              color="primary"
            />
            <StatCard
              title="Download Rate"
              value={formatBytesRate(stats.network.bytes_recv_rate)}
              icon={TrendingDown}
              color="blue"
            />
            <StatCard
              title="Upload Rate"
              value={formatBytesRate(stats.network.bytes_sent_rate)}
              icon={TrendingUp}
              color="purple"
            />
          </div>

          {/* IP Traffic Table */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary-500" />
              Top IP Addresses by Connections
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">IP Address</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Connections</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Data In Queue</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Data Out Queue</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Accessed Endpoints</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.ip_traffic.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No active connections
                      </td>
                    </tr>
                  ) : (
                    stats.ip_traffic.map((ip, index) => (
                      <tr key={index} className="border-b border-slate-100 hover:bg-primary-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary-500" />
                            <span className="font-mono text-sm">{ip.ip}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                            {ip.connections}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">{formatBytes(ip.bytes_in)}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{formatBytes(ip.bytes_out)}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {ip.urls.slice(0, 3).map((url, i) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono">
                                {url}
                              </span>
                            ))}
                            {ip.urls.length > 3 && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">
                                +{ip.urls.length - 3} more
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Network Interfaces */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-primary-500" />
              Network Interfaces
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(stats.network.interfaces).map(([name, data]: [string, any]) => (
                <div key={name} className="p-4 bg-white/50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Network className="w-4 h-4 text-primary-500" />
                    <span className="font-medium text-slate-700">{name}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Received:</span>
                      <span className="font-mono text-slate-700">{formatBytes(data.bytes_recv)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sent:</span>
                      <span className="font-mono text-slate-700">{formatBytes(data.bytes_sent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Packets In:</span>
                      <span className="font-mono text-slate-700">{data.packets_recv.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Packets Out:</span>
                      <span className="font-mono text-slate-700">{data.packets_sent.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Processes Tab */}
      {activeTab === 'processes' && stats && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary-500" />
              Top Processes by CPU Usage
            </h3>
            <div className="space-y-4">
              {stats.processes.map((proc, index) => (
                <div key={proc.pid} className="flex items-center gap-4 p-4 bg-white/50 rounded-xl hover:bg-primary-50/50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-800 truncate">{proc.name}</span>
                      <span className="text-xs text-slate-400 font-mono">PID: {proc.pid}</span>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>CPU</span>
                          <span>{proc.cpu_percent.toFixed(1)}%</span>
                        </div>
                        <ProgressBar value={proc.cpu_percent} showLabel={false} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Memory</span>
                          <span>{proc.memory_percent.toFixed(1)}%</span>
                        </div>
                        <ProgressBar value={proc.memory_percent} showLabel={false} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 text-center text-sm text-slate-400">
        <p>VPS Monitor Dashboard • Built with Next.js & FastAPI</p>
      </footer>
    </main>
  );
}
