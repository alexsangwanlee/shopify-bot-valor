/**
 * @file src/renderer/src/components/LogViewer.tsx
 * @description 개별 태스크의 실시간 로그를 표시하는 전용 뷰어
 */

import React from 'react';
import { useTaskStore } from '../stores/taskStore';
import { X, Search, Trash2 } from 'lucide-react';

interface LogViewerProps {
  taskId: string;
  onClose: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ taskId, onClose }) => {
  const logs = useTaskStore((state) => state.logs.get(taskId) || []);
  const clearLogs = useTaskStore((state) => state.clearLogs);

  return (
    <div className="flex flex-col h-full bg-surface border border-white/5 rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between px-6 py-4 bg-white/5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-valor-accent shadow-accent-glow" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Task Logs: {taskId.slice(0, 8)}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => clearLogs(taskId)}
            className="p-1.5 hover:bg-white/5 text-text-muted transition-colors"
          >
            <Trash2 size={16} />
          </button>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 text-text-muted transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[11px] custom-scrollbar bg-[#080809]">
        {logs.length === 0 && (
          <div className="flex items-center justify-center h-full text-text-muted italic">
            No logs available for this task.
          </div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-3 leading-relaxed">
            <span className="text-text-muted min-w-[60px]">{log.timestamp}</span>
            <span className={`font-bold w-16 uppercase ${
              log.level === 'error' ? 'text-red-400' : 
              log.level === 'success' ? 'text-valor-accent' : 
              log.level === 'warning' ? 'text-yellow-400' : 'text-primary'
            }`}>
              [{log.level}]
            </span>
            <span className="text-text flex-1 break-all">{log.message}</span>
          </div>
        ))}
      </div>

      <div className="p-3 bg-white/5 border-t border-white/5 relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
        <input 
          type="text" 
          placeholder="Filter logs..." 
          className="w-full bg-surface/50 border border-white/5 rounded-lg pl-10 pr-4 py-2 focus:outline-none text-xs"
        />
      </div>
    </div>
  );
};
