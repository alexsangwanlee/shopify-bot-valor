import React from 'react';
import { Activity, ShieldCheck, Wifi } from 'lucide-react';
import { useTaskStore } from '../stores/useTaskStore';

export const StatusBar: React.FC = () => {
  const stats = useTaskStore((state) => state.stats);
  const activeCount = stats.running + stats.processing;

  return (
    <div className="z-50 flex h-10 items-center justify-between border-t border-white/10 bg-black/25 px-6 text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
          <Activity size={12} className="text-valor-accent" />
          <span>
            Engines: <span className="text-text">{activeCount}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
          <ShieldCheck size={12} className="text-amber-300" />
          <span>
            Queue: <span className="text-text">{stats.waiting}</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
          {stats.total} total
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-valor-accent/20 bg-valor-accent/10 px-3 py-1.5 text-valor-accent">
          <Wifi size={12} />
          <span>CONNECTED</span>
        </div>
      </div>
    </div>
  );
};
