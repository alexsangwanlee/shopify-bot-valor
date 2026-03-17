/**
 * @file src/renderer/src/pages/Dashboard.tsx
 * @description 대시보드 페이지 (실시간 통계 및 텔레메트리 차트 포함)
 */

import React, { useEffect } from 'react';
import { 
  Activity, 
  ShoppingCart, 
  AlertTriangle, 
  CheckCircle2,
  TrendingUp,
  Clock
} from 'lucide-react';
import { StatsChart } from '../components/charts/StatsChart';
import { useTaskStore } from '../stores/useTaskStore';

export const Dashboard: React.FC = () => {
  const stats = useTaskStore((state) => state.stats);
  const { setStats } = useTaskStore();

  // 주기적으로 통계 업데이트 (IPC invoke)
  useEffect(() => {
    const fetchStats = async () => {
      const liveStats = await window.electronAPI.getTaskStats();
      setStats(liveStats);
    };
    
    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, [setStats]);

  const Cards = [
    { label: 'Total Checkouts', value: stats.success.toLocaleString(), icon: CheckCircle2, color: 'text-valor-accent', bg: 'bg-valor-accent/10' },
    { label: 'Active Tasks', value: stats.running.toString(), icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'ATC Count', value: '0', icon: ShoppingCart, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Failures', value: stats.failed.toLocaleString(), icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-[1000px]">
      <div className="grid grid-cols-4 gap-6">
        {Cards.map((card, i) => (
          <div key={i} className="glass-card p-6 h-32 flex flex-col justify-between border-white/5 hover:border-white/10 transition-all group">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] italic text-white/20 group-hover:text-white/40 transition-colors">{card.label}</span>
              <div className={`p-2.5 rounded-xl ${card.bg} ${card.color} shadow-lg shadow-black/20`}>
                <card.icon size={18} />
              </div>
            </div>
            <p className="text-3xl font-black italic tracking-tighter">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 glass-card p-8 flex flex-col border-white/5">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-8 bg-valor-accent rounded-full" />
              <div className="flex flex-col">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] italic text-white">Live Telemetry</h3>
                <span className="text-[9px] font-bold text-white/20 uppercase">Real-time throughput analysis</span>
              </div>
            </div>
            <div className="flex items-center gap-6 text-[10px] font-black italic tracking-widest text-white/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-valor-accent shadow-accent-glow" />
                <span>SUCCESS</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 shadow-red-500/50" />
                <span>FAILURE</span>
              </div>
            </div>
          </div>
          <StatsChart />
        </div>

        <div className="glass-card p-8 border-white/5">
          <div className="flex items-center gap-3 mb-8">
            <Clock size={20} className="text-valor-accent" />
            <div className="flex flex-col">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] italic text-white">System Nodes</h3>
              <span className="text-[9px] font-bold text-white/20 uppercase">Network Latency</span>
            </div>
          </div>
          <div className="space-y-8">
            {['Supreme API', 'Akamai TLS', 'Datadome', 'Captcha Solver'].map((provider, i) => (
              <div key={i} className="group">
                <div className="flex justify-between text-[10px] font-black mb-3 uppercase tracking-widest italic transition-colors">
                  <span className="text-white/30 group-hover:text-white/60">{provider}</span>
                  <span className="text-valor-accent">{(15 + i * 12 + Math.floor(Math.random() * 5))}ms</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-valor-accent to-blue-500 shadow-accent-glow" 
                    style={{ width: `${98 - i * 4}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card p-8 border-white/5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-valor-accent" />
            <div className="flex flex-col">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] italic text-white">Recent Success Feed</h3>
              <span className="text-[9px] font-bold text-white/20 uppercase">Live order updates</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:border-valor-accent/30 transition-all cursor-pointer group">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-xl bg-[#0a0a0b] border border-white/10 flex items-center justify-center overflow-hidden">
                   <Activity size={20} className="text-white/10" />
                </div>
                <div>
                  <p className="text-xs font-black italic text-white uppercase tracking-tight group-hover:text-valor-accent transition-colors">Supreme Buju Banton Tee</p>
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-1">Size L • White • 1.4s</p>
                </div>
              </div>
              <div className="bg-valor-accent/10 px-4 py-1.5 rounded-full border border-valor-accent/30 self-center">
                <span className="text-[10px] font-black text-valor-accent italic tracking-tighter uppercase font-mono">ORDER-0{842 + i}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
