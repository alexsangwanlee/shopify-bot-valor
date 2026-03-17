/**
 * @file src/renderer/src/components/TopBar.tsx
 * @description 프레이리스 창을 위한 상단 바 및 창 제어 버튼
 */

import React from 'react';
import { Minus, X } from 'lucide-react';

export const TopBar: React.FC = () => {
  const handleMinimize = () => {
    (window as any).electronAPI.windowControls('minimize');
  };

  const handleClose = () => {
    (window as any).electronAPI.windowControls('close');
  };

  return (
    <div className="drag-region z-50 flex h-12 items-center justify-between border-b border-white/10 bg-black/20 px-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-valor-accent shadow-accent-glow" />
          <span className="text-[9px] font-black uppercase tracking-[0.32em] text-white/45">
            Antigravity AIO
          </span>
        </div>
        <div className="hidden text-[9px] font-bold uppercase tracking-[0.24em] text-white/20 md:block">
          Desktop control surface
        </div>
      </div>

      <div className="no-drag-region flex items-center gap-2">
        <div className="data-chip hidden md:inline-flex">local runtime</div>
        <button 
          onClick={handleMinimize}
          className="rounded-xl p-2.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text"
        >
          <Minus size={14} />
        </button>
        <button 
          onClick={handleClose}
          className="rounded-xl p-2.5 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
