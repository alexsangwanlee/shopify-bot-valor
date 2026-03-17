import React, { useMemo, useState } from 'react';
import { X, Search, Trash2 } from 'lucide-react';
import { useTaskStore } from '../stores/useTaskStore';
import { TaskId } from '@core/task/types';

interface LogViewerProps {
  taskId: string;
  onClose: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ taskId, onClose }) => {
  const task = useTaskStore((state) => state.tasks.find((candidate) => candidate.id === taskId));
  const clearTaskLogs = useTaskStore((state) => state.clearTaskLogs);
  const [query, setQuery] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const logs = task?.logs ?? [];
  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return logs;
    }

    return logs.filter((log) => log.toLowerCase().includes(normalizedQuery));
  }, [logs, query]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/5 bg-surface shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-valor-accent shadow-accent-glow" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider">Task Logs: {taskId.slice(0, 8)}</h3>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
              {task?.status ?? 'unknown'} | {filteredLogs.length}/{logs.length} visible
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isClearing ? (
            <div className="flex items-center gap-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-valor-accent">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-valor-accent" />
              Clearing...
            </div>
          ) : (
            <button
              onClick={async () => {
                if (confirm('Clear persistent logs for this task?')) {
                  setIsClearing(true);
                  try {
                    await clearTaskLogs(taskId as TaskId);
                  } finally {
                    setIsClearing(false);
                  }
                }
              }}
              className="p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-red-400"
              title="Clear Logs"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 text-text-muted transition-colors hover:bg-white/5">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto bg-[#080809] p-4 font-mono text-[11px]">
        {logs.length === 0 && (
          <div className="flex h-full items-center justify-center italic text-text-muted">
            No logs available for this task.
          </div>
        )}
        {logs.length > 0 && filteredLogs.length === 0 && (
          <div className="flex h-full items-center justify-center italic text-text-muted">
            No logs match that filter.
          </div>
        )}
        {filteredLogs.map((log, index) => (
          <div key={index} className="flex gap-3 leading-relaxed">
            <span className="min-w-[60px] text-text-muted">#{String(index + 1).padStart(2, '0')}</span>
            <span className="w-16 font-bold uppercase text-valor-accent">[LOG]</span>
            <span className="flex-1 break-all text-text">{log}</span>
          </div>
        ))}
      </div>

      <div className="relative border-t border-white/5 bg-white/5 p-3">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter logs..."
          className="w-full rounded-lg border border-white/5 bg-surface/50 py-2 pl-10 pr-4 text-xs focus:outline-none"
        />
      </div>
    </div>
  );
};
