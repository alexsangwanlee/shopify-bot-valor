/**
 * @file src/renderer/src/components/StatusBar.tsx
 * @description 하단 상태 표시줄
 */

import React from 'react';
import { Activity, ShieldCheck, Wifi } from 'lucide-react';

export const StatusBar: React.FC = () => {
  return (
    <div className="h-8 bg-surface/80 border-t border-white/5 flex items-center justify-between px-6 text-[10px] font-medium text-text-muted z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Activity size={12} className="text-valor-accent" />
          <span>TASKS RUNNING: <span className="text-text">12</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-primary" />
          <span>PROXIES: <span className="text-text">READY</span></span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span>V1.0.0</span>
        <div className="flex items-center gap-1.5 text-valor-accent">
          <Wifi size={12} />
          <span>CONNECTED</span>
        </div>
      </div>
    </div>
  );
};
