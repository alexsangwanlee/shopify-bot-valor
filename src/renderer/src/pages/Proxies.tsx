/**
 * @file src/renderer/src/pages/Proxies.tsx
 * @description 프록시 관리 페이지 (그룹화 및 대기열 연동)
 */

import React from 'react';
import { 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Zap, 
  Globe, 
  MoreVertical 
} from 'lucide-react';

export const Proxies: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[900px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-valor-accent/10 rounded-xl text-valor-accent shadow-accent-glow">
            <Globe size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest italic">Proxy Management</h2>
            <p className="text-[10px] text-text-muted font-bold tracking-tight">TOTAL: 1,240 • ACTIVE: 982 • DEAD: 258</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-2.5 rounded-xl transition-all text-[10px] font-black italic uppercase">
            TEST ALL
          </button>
          <button className="flex items-center gap-2 bg-valor-accent/10 hover:bg-valor-accent/20 text-valor-accent border border-valor-accent/20 px-6 py-2.5 rounded-xl transition-all text-[10px] font-black italic uppercase">
            <Plus size={14} />
            ADD GROUP
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {[
          { name: 'Residential US', count: 500, status: 'STABLE', color: 'text-valor-accent' },
          { name: 'ISP Premium', count: 240, status: 'FAST', color: 'text-primary' },
          { name: 'EU Dynamic', count: 500, status: 'STABLE', color: 'text-valor-accent' },
        ].map((group, i) => (
          <div key={i} className="glass-card p-6 hover:border-white/10 transition-all group cursor-pointer relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical size={14} className="text-text-muted" />
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-white/5 rounded-lg text-text-muted">
                <ShieldCheck size={16} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase italic tracking-wider">{group.name}</h4>
                <p className="text-[10px] text-text-muted font-bold uppercase">{group.count} Proxies Loaded</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={12} className={group.color} />
                <span className={`text-[10px] font-black italic ${group.color}`}>{group.status}</span>
              </div>
              <div className="flex gap-2">
                <button className="p-1.5 hover:bg-white/5 rounded-md text-text-muted transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
          <h4 className="text-[10px] font-black uppercase tracking-widest italic text-text-muted">Recent Ping Checks</h4>
          <span className="text-[10px] font-bold text-valor-accent">AVERAGE: 42ms</span>
        </div>
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-4">
                <span className="text-[11px] font-mono text-text">192.168.1.{i+10}:8080:user:pass</span>
                <span className="px-2 py-0.5 rounded bg-valor-accent/10 text-valor-accent text-[9px] font-black italic">US-EAST</span>
              </div>
              <span className="text-[11px] font-bold text-valor-accent italic">38ms</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
