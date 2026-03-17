/**
 * @file src/renderer/src/pages/Tasks.tsx
 * @description Supreme 전용 태스크 관리 페이지 (Tanstack Table v8 + Add Task Modal)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  RowSelectionState,
} from '@tanstack/react-table';
import { 
  Play, 
  Pause, 
  Trash2, 
  Terminal,
  Plus,
  X,
  Zap,
  Shield,
  Monitor,
  AlertCircle
} from 'lucide-react';
import { useTaskStore } from '../stores/useTaskStore';
import { SupremeTask, TaskId } from '../../../core/task/types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Tasks: React.FC = () => {
  const { tasks, setTasks, updateTask, addLog } = useTaskStore();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Form State
  const [newTaskMode, setNewTaskMode] = useState<'fast' | 'safe' | 'monitor'>('fast');
  const [inputVal, setInputVal] = useState('');
  const [selectedProfile, setSelectedProfile] = useState('default');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [profiles, setProfiles] = useState<any[]>([]);

  // IPC 싱크 데이터 로드
  useEffect(() => {
    const init = async () => {
      const [allTasks, allProfiles] = await Promise.all([
        window.electronAPI.getAllTasks(),
        (window.electronAPI as any).getProfiles?.() || Promise.resolve([]) 
      ]);
      setTasks(allTasks);
      setProfiles(allProfiles);
    };
    init();

    const unsubStatus = window.electronAPI.onTaskStatusChanged((payload: any) => {
      updateTask(payload.id as TaskId, { status: payload.status, result: payload.result });
    });

    const unsubLog = window.electronAPI.onTaskLogAppend((payload: any) => {
      addLog(payload.id as TaskId, payload.log);
    });

    return () => {
      unsubStatus();
      unsubLog();
    };
  }, [setTasks, updateTask, addLog]);

  // 태스크 생성
  const handleCreateTask = async () => {
    const taskInput: any = {
      mode: newTaskMode,
      profileId: selectedProfile,
      size: size || undefined,
      color: color || undefined,
    };

    if (newTaskMode === 'monitor') {
      taskInput.keywords = inputVal.split(',').map(k => k.trim()).filter(k => k.length > 0);
    } else {
      taskInput.url = inputVal;
    }

    try {
      const res = await window.electronAPI.addSupremeTask(taskInput);
      if (res.success) {
        setIsAddModalOpen(false);
        const allTasks = await window.electronAPI.getAllTasks();
        setTasks(allTasks);
        // Reset form
        setInputVal('');
        setSize('');
        setColor('');
      }
    } catch (err: any) {
      alert(`Failed to create task: ${err.message}`);
    }
  };

  // 컬럼 정의
  const columns = useMemo<ColumnDef<SupremeTask>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <div className="flex justify-center">
          <input
            type="checkbox"
            className="rounded border-white/10 bg-white/5 cursor-pointer accent-valor-accent w-4 h-4"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          <input
            type="checkbox"
            className="rounded border-white/10 bg-white/5 cursor-pointer accent-valor-accent w-4 h-4"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        </div>
      ),
      size: 40,
    },
    {
      accessorKey: 'status',
      header: 'STATUS',
      cell: ({ getValue }) => {
        const val = getValue() as string;
        const color = val === 'running' ? 'text-emerald-400' : 
                      val === 'success' ? 'text-blue-400' : 
                      val === 'failed' ? 'text-red-400' : 
                      val === 'paused' ? 'text-orange-400' : 
                      val === 'monitoring' ? 'text-amber-300' : 'text-white/20';
        return (
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentcolor]", val === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-current opacity-20')} />
            <span className={cn("text-[10px] font-black uppercase italic tracking-tighter", color)}>{val}</span>
          </div>
        );
      },
      size: 100,
    },
    {
      accessorKey: 'mode',
      header: 'MODE',
      cell: ({ getValue }) => {
        const val = getValue() as string;
        const Icon = val === 'fast' ? Zap : val === 'safe' ? Shield : Monitor;
        return (
          <div className="flex items-center gap-1.5 text-white/40 group-hover:text-white/60 transition-colors">
            <Icon size={10} />
            <span className="text-[9px] font-bold uppercase tracking-widest">{val}</span>
          </div>
        );
      },
      size: 80,
    },
    {
      header: 'ITEM / KEYWORDS',
      cell: ({ row }) => {
        const task = row.original;
        return (
          <div className="max-w-[220px] truncate group">
            <span className="text-[10px] font-black text-white/80 group-hover:text-valor-accent transition-colors italic uppercase tracking-tight">
              {task.url ? task.url.split('/').pop()?.replace(/-/g, ' ') : task.keywords?.join(', ')}
            </span>
            <div className="text-[9px] text-white/20 font-bold truncate uppercase tracking-[0.1em] mt-0.5 font-mono">
              {task.url || 'KEYWORD MONITOR'}
            </div>
          </div>
        );
      },
    },
    {
      header: 'SIZE / COLOR',
      cell: ({ row }) => <span className="text-[10px] font-bold text-white/30 italic uppercase">{(row.original.size || 'ANY') + ' / ' + (row.original.color || 'ANY')}</span>,
      size: 120,
    },
    {
      accessorKey: 'profileId',
      header: 'PROFILE',
      cell: ({ getValue }) => <span className="text-[10px] font-black tracking-[0.2em] text-valor-accent italic">{(getValue() as string).toUpperCase()}</span>,
      size: 100,
    },
    {
      header: 'LAST LOG',
      cell: ({ row }) => <span className="text-[10px] text-white/20 truncate block max-w-[180px] italic font-medium">{(row.original.logs && row.original.logs[0]) || 'Engine standby...'}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
          <button 
            onClick={() => window.electronAPI.operateTasks('start', [row.original.id])}
            className="p-2.5 hover:bg-emerald-500/10 rounded-xl transition-colors text-white/20 hover:text-emerald-400 group/btn"
          >
            <Play size={14} fill="currentColor" className="group-active/btn:scale-90 transition-transform" />
          </button>
          <button 
            onClick={() => window.electronAPI.operateTasks('pause', [row.original.id])}
            className="p-2.5 hover:bg-orange-500/10 rounded-xl transition-colors text-white/20 hover:text-orange-400 group/btn"
          >
            <Pause size={14} fill="currentColor" className="group-active/btn:scale-90 transition-transform" />
          </button>
          <button 
            onClick={() => window.electronAPI.operateTasks('cancel', [row.original.id])}
            className="p-2.5 hover:bg-red-500/10 rounded-xl transition-colors text-white/20 hover:text-red-400 group/btn"
          >
            <Trash2 size={14} className="group-active/btn:scale-90 transition-transform" />
          </button>
        </div>
      ),
      size: 120,
    }
  ], []);

  const table = useReactTable({
    data: tasks,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    getRowId: row => row.id,
  });

  const selectedCount = Object.keys(rowSelection).length;

  const handleBulkOperate = (action: 'start' | 'pause' | 'cancel' | 'retry') => {
    const ids = Object.keys(rowSelection);
    if (ids.length === 0) return;
    window.electronAPI.operateTasks(action, ids);
  };

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-1000">
      {/* Header Container */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <h2 className="text-2xl font-black uppercase tracking-[0.3em] italic text-white leading-none shadow-text">Supreme Engine</h2>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-1.5 h-1.5 rounded-full bg-valor-accent shadow-accent-glow animate-pulse" />
              <span className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase italic">Local Instance Sync Active</span>
            </div>
          </div>
          
          <div className="h-12 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          <div className="flex bg-[#121214] border border-white/5 rounded-2xl p-1.5 shadow-2xl">
            {['ALL', 'RUNNING', 'SUCCESS', 'FAILED'].map(status => (
              <button 
                key={status}
                className={cn(
                  "px-6 py-2.5 text-[10px] font-black transition-all rounded-xl italic uppercase tracking-widest",
                  status === 'ALL' ? "bg-valor-accent text-white shadow-lg shadow-valor-accent/30" : "text-white/20 hover:text-white/60"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          {selectedCount > 0 && (
            <div className="flex gap-2 animate-in slide-in-from-right-12 duration-500 items-center bg-white/[0.02] p-1.5 rounded-2xl border border-white/5 shadow-2xl">
              <span className="px-5 text-[10px] font-black italic text-valor-accent uppercase tracking-[0.2em]">{selectedCount} Tasks Locked</span>
              <button 
                onClick={() => handleBulkOperate('start')}
                className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-6 py-3.5 rounded-xl transition-all text-xs font-black italic uppercase tracking-wider active:scale-95"
              >
                <Play size={14} fill="currentColor" /> INITIATE
              </button>
              <button 
                onClick={() => handleBulkOperate('cancel')}
                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-6 py-3.5 rounded-xl transition-all text-xs font-black italic uppercase tracking-wider active:scale-95"
              >
                <Trash2 size={14} /> TERMINATE
              </button>
            </div>
          )}
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-4 bg-valor-accent hover:scale-[1.02] active:scale-[0.98] text-white px-12 py-5 rounded-[1.25rem] transition-all text-xs font-black italic uppercase tracking-[0.25em] shadow-accent-glow"
          >
            <Plus size={20} strokeWidth={4} /> NEW SEQUENCE
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 glass-card overflow-hidden border-white/5 shadow-3xl bg-[#0a0a0b]/40 backdrop-blur-3xl">
        <div className="h-full overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="bg-[#121214]/90 backdrop-blur-2xl sticky top-0 z-10 border-b border-white/5">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="py-7 px-8 text-[11px] font-black uppercase tracking-[0.25em] italic text-white/30">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {table.getRowModel().rows.map(row => (
                <tr 
                  key={row.id} 
                  className={cn(
                    "hover:bg-white/[0.04] transition-all group relative cursor-default border-l-4 border-l-transparent",
                    row.original.status === 'running' && "bg-emerald-500/[0.06] border-l-emerald-400",
                    row.original.status === 'monitoring' && "bg-amber-500/[0.06] border-l-amber-400",
                    row.original.status === 'success' && "bg-blue-500/[0.06] border-l-blue-400",
                    row.original.status === 'failed' && "bg-red-500/[0.06] border-l-red-400"
                  )}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="py-6 px-8">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-56 text-center">
                    <div className="flex flex-col items-center gap-8 opacity-20 animate-pulse">
                      <Terminal size={80} strokeWidth={1} className="text-valor-accent" />
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-black uppercase tracking-[0.6em] italic text-white">Kernel Idle</span>
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Awaiting task initialization</span>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Footer Nodes */}
      <div className="flex items-center justify-between px-8 py-5 bg-white/[0.02] rounded-3xl border border-white/5">
        <div className="flex gap-12 items-center">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span className="text-[11px] font-black text-white/40 uppercase tracking-widest italic">Live Engines: <span className="text-white ml-2 font-mono">{tasks.filter(t => t.status === 'running').length}</span></span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" />
            <span className="text-[11px] font-black text-white/40 uppercase tracking-widest italic">Checkouts: <span className="text-white ml-2 font-mono">{tasks.filter(t => t.status === 'success').length}</span></span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-black text-white/10 uppercase tracking-[0.4em] italic select-none">
          <Zap size={12} fill="currentColor" /> VALOR AIO SUPREME MODULE • SYNC v2.8.19
        </div>
      </div>

      {/* Add Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl animate-in fade-in duration-500 p-8">
          <div className="bg-[#0f0f11] border border-white/10 w-full max-w-2xl rounded-[3rem] shadow-3xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500 border-t-white/20">
            <div className="p-10 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-transparent to-white/[0.02]">
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                   <Plus className="text-valor-accent" size={24} strokeWidth={4} />
                   <h3 className="text-2xl font-black uppercase italic tracking-[0.1em] leading-none text-white">Initialize Sequence</h3>
                </div>
                <span className="text-[11px] font-bold text-white/20 uppercase mt-3 tracking-widest">Target supreme checkout configuration</span>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-4 hover:bg-white/10 rounded-2xl text-white/20 hover:text-white transition-all active:scale-90"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-12 space-y-10 flex-1 overflow-auto custom-scrollbar">
              <div className="grid grid-cols-3 gap-4">
                {(['fast', 'safe', 'monitor'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setNewTaskMode(mode)}
                    className={cn(
                      "flex flex-col items-center gap-4 p-8 rounded-[2rem] border-2 transition-all group relative overflow-hidden",
                      newTaskMode === mode ? "bg-valor-accent/10 border-valor-accent shadow-2xl shadow-valor-accent/20" : "bg-white/[0.03] border-transparent opacity-30 hover:opacity-100 hover:bg-white/[0.06]"
                    )}
                  >
                    {newTaskMode === mode && <div className="absolute top-0 right-0 w-12 h-12 bg-valor-accent/20 rounded-bl-[2rem] flex items-center justify-center animate-in slide-in-from-top-4 slide-in-from-right-4"><Zap size={14} className="text-valor-accent" /></div>}
                    {mode === 'fast' && <Zap className={cn("transition-transform group-hover:scale-110", newTaskMode === mode ? "text-valor-accent" : "text-white")} size={28} />}
                    {mode === 'safe' && <Shield className={cn("transition-transform group-hover:scale-110", newTaskMode === mode ? "text-valor-accent" : "text-white")} size={28} />}
                    {mode === 'monitor' && <Monitor className={cn("transition-transform group-hover:scale-110", newTaskMode === mode ? "text-valor-accent" : "text-white")} size={28} />}
                    <span className={cn("text-[12px] font-black uppercase tracking-widest italic", newTaskMode === mode ? "text-valor-accent" : "text-white")}>{mode}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-8">
                <div className="flex flex-col gap-3 group">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em] italic group-hover:text-valor-accent transition-colors">
                      {newTaskMode === 'monitor' ? 'Target Keywords' : 'Supreme Product URL'}
                    </label>
                    <AlertCircle size={14} className="text-white/10" />
                  </div>
                  <input 
                    type="text" 
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder={newTaskMode === 'monitor' ? "+keyword, -exclude, keyword" : "https://www.supremenewyork.com/shop/..."}
                    className="bg-[#0a0a0b] border border-white/10 rounded-2xl p-6 text-sm font-black text-white focus:outline-none focus:border-valor-accent/50 transition-all italic w-full placeholder:text-white/5 shadow-inner"
                  />
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="flex flex-col gap-3">
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em] italic ml-1">Assigned Profile</label>
                    <select 
                      value={selectedProfile}
                      onChange={(e) => setSelectedProfile(e.target.value)}
                      className="bg-[#0a0a0b] border border-white/10 rounded-2xl p-6 text-sm font-black text-white focus:outline-none focus:border-valor-accent/50 transition-all italic appearance-none cursor-pointer"
                    >
                      <option value="default" className="bg-[#0f0f11]">DEFAULT CORE</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id} className="bg-[#0f0f11] uppercase">{p.name || p.id}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-3">
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em] italic ml-1">Variant Selection</label>
                    <div className="grid grid-cols-2 gap-4">
                      <input 
                        type="text" 
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        placeholder="SIZE" 
                        className="bg-[#0a0a0b] border border-white/10 rounded-2xl p-6 text-sm font-black text-white focus:outline-none focus:border-valor-accent/50 transition-all italic placeholder:text-white/5" 
                      />
                      <input 
                        type="text" 
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        placeholder="COLOR" 
                        className="bg-[#0a0a0b] border border-white/10 rounded-2xl p-6 text-sm font-black text-white focus:outline-none focus:border-valor-accent/50 transition-all italic placeholder:text-white/5" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-10 border-t border-white/5 bg-white/[0.01]">
              <button 
                onClick={handleCreateTask}
                className="w-full bg-valor-accent text-white py-6 rounded-[2rem] font-black italic uppercase tracking-[0.3em] text-sm shadow-accent-glow hover:brightness-110 active:scale-[0.98] transition-all transform hover:-translate-y-1"
              >
                Deploy Engine Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
