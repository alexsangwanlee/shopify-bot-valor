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
    <div className="h-10 bg-surface/50 border-b border-white/5 flex items-center justify-between px-4 drag-region z-50">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-valor-accent shadow-accent-glow" />
        <span className="text-[10px] font-bold tracking-widest text-text-muted uppercase">Antigravity AIO</span>
      </div>
      <div className="flex no-drag-region">
        <button 
          onClick={handleMinimize}
          className="p-2 hover:bg-white/5 text-text-muted hover:text-text transition-colors"
        >
          <Minus size={14} />
        </button>
        <button 
          onClick={handleClose}
          className="p-2 hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
