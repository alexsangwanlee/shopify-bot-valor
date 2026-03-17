import React from 'react';
import { Radar, BellRing, SearchCheck, Activity } from 'lucide-react';
import { useTaskStore } from '../stores/useTaskStore';

export const Monitor: React.FC = () => {
  const tasks = useTaskStore((state) => state.tasks);
  const monitorTasks = tasks.filter((task) => task.mode === 'monitor');
  const activeMonitors = monitorTasks.filter(
    (task) => task.status === 'monitoring' || task.status === 'running',
  ).length;
  const keywordHits = monitorTasks.reduce(
    (count, task) => count + (task.result?.monitorHits ?? 0),
    0,
  );
  const matchedProducts = monitorTasks.filter((task) => task.result?.matchedTitle).length;
  const hottestTask = [...monitorTasks]
    .sort((left, right) => (right.result?.matchScore ?? 0) - (left.result?.matchScore ?? 0))[0];

  return (
    <div className="max-w-[1180px] space-y-8 animate-in fade-in duration-700">
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="glass-card-intense relative overflow-hidden p-8">
          <div className="pointer-events-none absolute right-[-30px] top-[-20px] h-52 w-52 rounded-full bg-amber-300/10 blur-[90px]" />
          <div className="pointer-events-none absolute bottom-[-40px] left-[18%] h-44 w-44 rounded-full bg-valor-accent/10 blur-[100px]" />

          <div className="relative">
            <div className="section-kicker">Monitor Grid</div>
            <h2 className="mt-4 panel-title text-[1.9rem] tracking-[0.14em]">
              Keyword Catch Control
            </h2>
            <p className="mt-4 max-w-[540px] text-[12px] font-bold uppercase leading-relaxed tracking-[0.16em] text-white/42">
              Track category listings, score keyword matches, and keep the hottest watchlists visible without digging into logs.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <span className="data-chip">watchlists {monitorTasks.length}</span>
              <span className="data-chip">monitoring {activeMonitors}</span>
              <span className="data-chip">hits {keywordHits}</span>
              <span className="data-chip">matched {matchedProducts}</span>
            </div>
          </div>
        </div>

        <div className="glass-card border-white/5 p-8">
          <div className="section-kicker">Top Signal</div>
          <div className="mt-4 flex items-center justify-between">
            <h3 className="panel-title text-base tracking-[0.18em]">Current Hot Match</h3>
            <BellRing size={18} className="text-amber-300" />
          </div>

          {hottestTask ? (
            <div className="mt-7 rounded-[1.6rem] border border-white/10 bg-black/20 p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/25">
                {hottestTask.monitorCategory || 'all categories'}
              </div>
              <div className="mt-3 text-lg font-black uppercase italic tracking-[0.08em] text-white">
                {hottestTask.result?.matchedTitle || hottestTask.keywords?.join(', ') || 'No match yet'}
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em]">
                <span className="text-white/35">match score</span>
                <span className="text-cyan-300">
                  {hottestTask.result?.matchScore ? Math.round(hottestTask.result.matchScore) : '--'}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 via-valor-accent to-cyan-300"
                  style={{ width: `${Math.max(12, Math.min(100, Math.round(hottestTask.result?.matchScore ?? 12)))}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-7 rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">
              No watchlists active yet
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        {[
          { icon: Radar, label: 'Watchlists', value: monitorTasks.length },
          { icon: SearchCheck, label: 'Monitoring', value: activeMonitors },
          { icon: BellRing, label: 'Keyword Hits', value: keywordHits },
          { icon: Activity, label: 'Matched Titles', value: matchedProducts },
        ].map((item) => (
          <div key={item.label} className="glass-card border-white/5 p-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                {item.label}
              </span>
              <item.icon size={18} className="text-valor-accent" />
            </div>
            <div className="mt-8 text-3xl font-black italic text-white">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="glass-card border-white/5 p-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Activity size={18} className="text-valor-accent" />
            <h3 className="text-sm font-black uppercase italic tracking-[0.2em] text-white">
              Watchlist Overview
            </h3>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/25">
            ranked by live match confidence
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {monitorTasks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center text-[11px] font-bold uppercase tracking-[0.25em] text-white/30">
              No monitor tasks yet. Add one from the Tasks page.
            </div>
          )}

          {[...monitorTasks]
            .sort((left, right) => (right.result?.matchScore ?? 0) - (left.result?.matchScore ?? 0))
            .map((task) => (
            <div
              key={task.id}
              className="grid items-center gap-5 rounded-[1.6rem] border border-white/5 bg-white/[0.02] px-6 py-5 xl:grid-cols-[1.3fr_180px]"
            >
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                  {task.result?.matchedTitle || (task.keywords ?? []).join(', ') || 'No keywords'}
                </div>
                <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                  Status: {task.status}
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/70">
                  Category: {task.monitorCategory || 'all'}
                </div>
                {task.result?.matchedHandle ? (
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/70">
                    Handle: {task.result.matchedHandle}
                  </div>
                ) : null}
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                  Last heartbeat:{' '}
                  {task.result?.lastHeartbeatAt
                    ? new Date(task.result.lastHeartbeatAt).toLocaleTimeString()
                    : 'Pending'}
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-right text-[10px] font-black uppercase tracking-[0.2em] text-valor-accent">
                  {task.result?.matchScore ? `Score ${Math.round(task.result.matchScore)}` : task.logs[0] ?? 'Awaiting event'}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300 via-valor-accent to-cyan-300"
                    style={{ width: `${Math.max(8, Math.min(100, Math.round(task.result?.matchScore ?? 8)))}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
