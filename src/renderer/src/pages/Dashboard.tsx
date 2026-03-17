import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react';
import { StatsChart, type StatsChartPoint } from '../components/charts/StatsChart';
import { useTaskStore } from '../stores/useTaskStore';

export const Dashboard: React.FC = () => {
  const tasks = useTaskStore((state) => state.tasks);
  const stats = useTaskStore((state) => state.stats);
  const { setStats } = useTaskStore();
  const [profilesCount, setProfilesCount] = useState(0);
  const [proxyGroupsCount, setProxyGroupsCount] = useState(0);
  const [history, setHistory] = useState<StatsChartPoint[]>([]);

  useEffect(() => {
    const loadSupportingData = async () => {
      const [profiles, proxyGroups] = await Promise.all([
        window.electronAPI.getProfiles(),
        window.electronAPI.getProxyGroups(),
      ]);

      setProfilesCount(profiles.length);
      setProxyGroupsCount(proxyGroups.length);
    };

    const fetchStats = async () => {
      const liveStats = await window.electronAPI.getTaskStats();
      setStats(liveStats);
      setHistory((current) => {
        const timestamp = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        const nextPoint: StatsChartPoint = {
          time: timestamp,
          success: liveStats.success,
          failed: liveStats.failed,
        };

        return [...current, nextPoint].slice(-12);
      });
    };

    void loadSupportingData();
    void fetchStats();

    const statsInterval = setInterval(fetchStats, 2000);
    const slowInterval = setInterval(loadSupportingData, 30000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(slowInterval);
    };
  }, [setStats]);

  const atcCount = useMemo(
    () => tasks.filter((task) => task.logs.some((log) => log.includes('Cart request prepared'))).length,
    [tasks],
  );

  const successfulTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status === 'success')
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, 4),
    [tasks],
  );

  const cards = [
    {
      label: 'Total Checkouts',
      value: stats.success.toLocaleString(),
      icon: CheckCircle2,
      color: 'text-valor-accent',
      bg: 'bg-valor-accent/10',
    },
    {
      label: 'Active Tasks',
      value: (stats.running + stats.processing).toString(),
      icon: Activity,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
    },
    {
      label: 'ATC Count',
      value: atcCount.toString(),
      icon: ShoppingCart,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
    },
    {
      label: 'Failures',
      value: stats.failed.toLocaleString(),
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-400/10',
    },
  ];

  const systemCards = [
    { label: 'Profiles Loaded', value: profilesCount, icon: ShieldCheck, color: 'text-valor-accent' },
    { label: 'Proxy Groups', value: proxyGroupsCount, icon: Globe, color: 'text-blue-400' },
    { label: 'Processing', value: stats.processing, icon: ShoppingCart, color: 'text-cyan-300' },
    { label: 'Queued Tasks', value: stats.waiting, icon: Database, color: 'text-amber-300' },
    { label: 'Snapshots', value: history.length, icon: Clock, color: 'text-white/60' },
  ];

  const queuePressure =
    stats.total > 0 ? Math.min(100, Math.round(((stats.waiting + stats.processing) / stats.total) * 100)) : 0;

  const formatVariant = (task: (typeof tasks)[number]) => {
    const size = Array.isArray(task.size) ? task.size.join(', ') : task.size || 'Any';
    const color = task.color || 'Any';
    return `${size.toUpperCase()} / ${color.toUpperCase()}`;
  };

  const formatTaskLabel = (task: (typeof tasks)[number]) => {
    if (task.url) {
      return task.url.split('/').pop()?.replace(/-/g, ' ') ?? task.url;
    }

    return task.keywords?.join(', ') || 'Keyword Match';
  };

  return (
    <div className="max-w-[1180px] space-y-8 animate-in fade-in duration-700">
      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="glass-card-intense relative overflow-hidden p-8">
          <div className="pointer-events-none absolute right-[-40px] top-[-40px] h-56 w-56 rounded-full bg-valor-accent/10 blur-[90px]" />
          <div className="pointer-events-none absolute bottom-[-50px] left-[25%] h-48 w-48 rounded-full bg-blue-500/10 blur-[100px]" />

          <div className="relative">
            <div className="section-kicker">Command Overview</div>
            <div className="mt-4 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-[520px]">
                <h2 className="panel-title text-[2rem] tracking-[0.12em]">
                  Live Checkout Command
                </h2>
                <p className="mt-4 max-w-[520px] text-[12px] font-bold uppercase leading-relaxed tracking-[0.16em] text-white/42">
                  This board blends queue pressure, task velocity, and checkout output into one local control surface.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 px-5 py-4">
                  <div className="section-kicker">Success</div>
                  <div className="mt-3 text-3xl font-black italic text-white">{stats.success}</div>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 px-5 py-4">
                  <div className="section-kicker">Active</div>
                  <div className="mt-3 text-3xl font-black italic text-white">
                    {stats.running + stats.processing}
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 px-5 py-4">
                  <div className="section-kicker">Queue Load</div>
                  <div className="mt-3 text-3xl font-black italic text-white">{queuePressure}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card border-white/5 p-8">
          <div className="section-kicker">System Pulse</div>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h3 className="panel-title text-base tracking-[0.18em]">Runtime Health</h3>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
                queue, data, and processing mix
              </p>
            </div>
            <Clock size={18} className="text-valor-accent" />
          </div>

          <div className="mt-8 space-y-6">
            {systemCards.map((item, index) => (
              <div key={item.label} className="group">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon size={14} className={item.color} />
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                      {item.label}
                    </span>
                  </div>
                  <span className={`text-sm font-black italic ${item.color}`}>{item.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-valor-accent via-cyan-300 to-blue-400"
                    style={{ width: `${Math.max(16, 100 - index * 13)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="glass-card group flex h-36 flex-col justify-between border-white/5 p-6 transition-all hover:-translate-y-1 hover:border-white/10"
          >
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] italic text-white/20 transition-colors group-hover:text-white/40">
                {card.label}
              </span>
              <div className={`rounded-xl p-2.5 shadow-lg shadow-black/20 ${card.bg} ${card.color}`}>
                <card.icon size={18} />
              </div>
            </div>
            <p className="text-3xl font-black italic tracking-tighter">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.4fr_0.85fr]">
        <div className="glass-card col-span-1 flex flex-col border-white/5 p-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-2 rounded-full bg-valor-accent" />
              <div className="flex flex-col">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] italic text-white">
                  Live Telemetry
                </h3>
                <span className="text-[9px] font-bold uppercase text-white/20">
                  Real task counters from the queue
                </span>
              </div>
            </div>
          </div>
          <StatsChart data={history.length > 0 ? history : [{ time: '--:--', success: 0, failed: 0 }]} />
        </div>

        <div className="glass-card border-white/5 p-8">
          <div className="section-kicker">Queue Pressure</div>
          <div className="mt-4 flex items-center justify-between">
            <h3 className="panel-title text-base tracking-[0.18em]">Throughput Mix</h3>
            <Database size={18} className="text-amber-300" />
          </div>

          <div className="mt-7 space-y-5">
            {[
              { label: 'Running + Monitoring', value: stats.running, accent: 'bg-emerald-400' },
              { label: 'Processing Holds', value: stats.processing, accent: 'bg-cyan-300' },
              { label: 'Queue Waiting', value: stats.waiting, accent: 'bg-amber-300' },
              { label: 'Failures', value: stats.failed, accent: 'bg-red-400' },
            ].map((item) => {
              const width =
                stats.total > 0 ? Math.max(8, Math.round((item.value / Math.max(1, stats.total)) * 100)) : 8;

              return (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                    <span>{item.label}</span>
                    <span className="text-white/70">{item.value}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                    <div className={`h-full rounded-full ${item.accent}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="glass-card border-white/5 p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-valor-accent" />
            <div className="flex flex-col">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] italic text-white">
                Recent Success Feed
              </h3>
              <span className="text-[9px] font-bold uppercase text-white/20">
                Latest successful tasks from local state
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {successfulTasks.length === 0 && (
            <div className="col-span-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center text-[11px] font-bold uppercase tracking-[0.25em] text-white/30">
              No successful tasks yet.
            </div>
          )}

          {successfulTasks.map((task) => (
            <div
              key={task.id}
              className="group flex cursor-default items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-valor-accent/30"
            >
              <div className="flex items-center gap-5">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0b]">
                  <Activity size={20} className="text-white/10" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase italic tracking-tight text-white transition-colors group-hover:text-valor-accent">
                    {formatTaskLabel(task)}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/20">
                    {formatVariant(task)} | PROFILE {task.profileId}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/20">
                    Stage: {(task.result?.lastStage || 'completed').toUpperCase()}
                  </p>
                </div>
              </div>
              <div className="self-center rounded-full border border-valor-accent/30 bg-valor-accent/10 px-4 py-1.5">
                <span className="font-mono text-[10px] font-black uppercase italic tracking-tighter text-valor-accent">
                  {task.result?.orderNumber ?? task.id.slice(0, 8)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
