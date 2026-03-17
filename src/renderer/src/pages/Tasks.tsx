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
  ExternalLink,
  Plus,
  X,
  Zap,
  Shield,
  Monitor,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BillingProfile, ProxyGroup } from '@core/app-data';
import { TaskLogPayload, TaskStatusPayload } from '@core/ipc/contracts';
import { useTaskStore } from '../stores/useTaskStore';
import { CheckoutMode, SupremeTask, TaskId } from '@core/task/types';
import { LogViewer } from '../components/LogViewer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatElapsedDuration(ms?: number) {
  if (typeof ms !== 'number' || ms < 0) {
    return '--';
  }

  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

const CHECKOUT_MODE_META: Record<
  CheckoutMode,
  { label: string; description: string; accent: string; glow: string; icon: typeof Zap }
> = {
  auto: {
    label: 'AUTO',
    description: 'Full send plus automatic processing rechecks.',
    accent: 'text-emerald-300',
    glow: 'bg-emerald-400/15 border-emerald-400/20',
    icon: Zap,
  },
  assist: {
    label: 'ASSIST',
    description: 'Automate until extra auth, then pause for manual follow-up.',
    accent: 'text-amber-300',
    glow: 'bg-amber-400/15 border-amber-400/20',
    icon: AlertCircle,
  },
  browser: {
    label: 'BROWSER',
    description: 'Build the checkout and hand it off before final submit.',
    accent: 'text-cyan-300',
    glow: 'bg-cyan-400/15 border-cyan-400/20',
    icon: ExternalLink,
  },
};

const PAYMENT_METHOD_META = {
  paypal: {
    label: 'PAYPAL',
    description: 'Best fit for redirect and manual handoff flows.',
  },
  card: {
    label: 'CARD',
    description: 'Needs task-level card payload for non-browser automation.',
  },
} as const;

const CHECKOUT_MODE_OPTIONS = Object.entries(CHECKOUT_MODE_META) as Array<
  [CheckoutMode, (typeof CHECKOUT_MODE_META)[CheckoutMode]]
>;

const PAYMENT_METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_META) as Array<
  ['paypal' | 'card', { label: string; description: string }]
>;

export const Tasks: React.FC = () => {
  const { tasks, setTasks, updateTask, addLog } = useTaskStore();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTaskMode, setNewTaskMode] = useState<'fast' | 'safe' | 'monitor'>('fast');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'RUNNING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'>('ALL');
  const [inputVal, setInputVal] = useState('');
  const [selectedProfile, setSelectedProfile] = useState('default');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'paypal' | 'card'>('paypal');
  const [selectedCheckoutMode, setSelectedCheckoutMode] = useState<CheckoutMode>('auto');
  const [selectedProxyGroup, setSelectedProxyGroup] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [pollIntervalSec, setPollIntervalSec] = useState('3');
  const [monitorStoreUrl, setMonitorStoreUrl] = useState('https://www.supremenewyork.com');
  const [monitorCategory, setMonitorCategory] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editCheckoutMode, setEditCheckoutMode] = useState<CheckoutMode>('auto');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'paypal' | 'card'>('paypal');
  const [editProfileId, setEditProfileId] = useState<string>('default');
  const [editPollIntervalSec, setEditPollIntervalSec] = useState('2');
  const [editMonitorCategory, setEditMonitorCategory] = useState('');
  const [defaultMonitorPollIntervalSec, setDefaultMonitorPollIntervalSec] = useState(2);
  const [profiles, setProfiles] = useState<BillingProfile[]>([]);
  const [proxyGroups, setProxyGroups] = useState<ProxyGroup[]>([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const init = async () => {
      const [allTasks, allProfiles, allProxyGroups, config] = await Promise.all([
        window.electronAPI.getAllTasks(),
        window.electronAPI.getProfiles(),
        window.electronAPI.getProxyGroups(),
        window.electronAPI.getConfig(),
      ]);

      setTasks(allTasks);
      setProfiles(allProfiles);
      setProxyGroups(allProxyGroups);
      setDefaultMonitorPollIntervalSec(config.monitorDefaultPollIntervalSec);
      setPollIntervalSec(String(config.monitorDefaultPollIntervalSec));
    };

    void init();

    const unsubscribeStatus = window.electronAPI.onTaskStatusChanged((payload: TaskStatusPayload) => {
      const updates: Partial<SupremeTask> = {
        status: payload.status,
        queuedAt: payload.queuedAt,
        startedAt: payload.startedAt,
        waitDurationMs: payload.waitDurationMs,
      };
      if (payload.result) {
        updates.result = payload.result;
      }

      updateTask(payload.id, updates);
    });

    const unsubscribeLog = window.electronAPI.onTaskLogAppend((payload: TaskLogPayload) => {
      addLog(payload.id, payload.log);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeLog();
    };
  }, [setTasks, updateTask, addLog]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const handleCreateTask = async () => {
    const selectedProfileData = profiles.find((profile) => profile.id === selectedProfile);
    const taskInput: any = {
      mode: newTaskMode,
      profileId: selectedProfile,
      paymentMethod: selectedPaymentMethod,
      checkoutMode: selectedCheckoutMode,
      proxyGroup: selectedProxyGroup || undefined,
      size: size || undefined,
      color: color || undefined,
    };

    if (selectedPaymentMethod === 'card' && selectedCheckoutMode !== 'browser' && !selectedProfileData?.hasSecureCard) {
      alert('This profile does not have a secure card vault payload yet. Add a secure card to the profile or switch this task to Browser / PayPal.');
      return;
    }

    if (newTaskMode === 'monitor') {
      taskInput.keywords = inputVal
        .split(',')
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length > 0);
      taskInput.pollIntervalMs = Math.max(1, Number(pollIntervalSec) || defaultMonitorPollIntervalSec) * 1000;
      taskInput.url = monitorStoreUrl || 'https://www.supremenewyork.com';
      taskInput.monitorCategory = monitorCategory.trim() || undefined;
    } else {
      taskInput.url = inputVal;
    }

    try {
      const response = await window.electronAPI.addSupremeTask(taskInput);
      if (!response.success) {
        return;
      }

      setIsAddModalOpen(false);
      setTasks(await window.electronAPI.getAllTasks());
      setInputVal('');
      setSize('');
      setColor('');
      setPollIntervalSec(String(defaultMonitorPollIntervalSec));
      setMonitorCategory('');
      setSelectedPaymentMethod('paypal');
      setSelectedCheckoutMode('auto');
      setSelectedProxyGroup('');
    } catch (error) {
      const taskError = error as Error;
      alert(`Failed to create task: ${taskError.message}`);
    }
  };

  const handleOpenTaskEdit = (task: SupremeTask) => {
    setEditingTaskId(task.id);
    setEditCheckoutMode(task.checkoutMode ?? 'auto');
    setEditPaymentMethod(task.paymentMethod ?? 'paypal');
    setEditProfileId(task.profileId);
    setEditPollIntervalSec(String(Math.max(1, Math.round((task.pollIntervalMs ?? defaultMonitorPollIntervalSec * 1000) / 1000))));
    setEditMonitorCategory(task.mode === 'monitor' ? task.monitorCategory ?? '' : '');
  };

  const handleSaveTaskEdit = async () => {
    const task = tasks.find((candidate) => candidate.id === editingTaskId);
    if (!task) {
      return;
    }

    const profile = profiles.find((candidate) => candidate.id === editProfileId);
    if (editPaymentMethod === 'card' && editCheckoutMode !== 'browser' && !profile?.hasSecureCard && !task.creditCard) {
      alert('The assigned profile does not have a secure card payload. Add card data in Profiles or keep this task on Browser / PayPal.');
      return;
    }

    const response = await window.electronAPI.updateSupremeTask(task.id, {
      checkoutMode: editCheckoutMode,
      paymentMethod: editPaymentMethod,
      profileId: editProfileId,
      monitorCategory: task.mode === 'monitor' ? editMonitorCategory.trim() || undefined : undefined,
      pollIntervalMs:
        task.mode === 'monitor'
          ? Math.max(1, Number(editPollIntervalSec) || defaultMonitorPollIntervalSec) * 1000
          : task.pollIntervalMs,
    });

    if (!response.success) {
      alert(response.error || 'Failed to update task');
      return;
    }

    setTasks(await window.electronAPI.getAllTasks());
    setEditingTaskId(null);
  };

  const filteredTasks = useMemo(() => {
    if (activeFilter === 'ALL') {
      return tasks;
    }

    const targetStatus =
      activeFilter === 'RUNNING'
        ? null
        : activeFilter === 'PROCESSING'
          ? 'processing'
        : activeFilter === 'SUCCESS'
          ? 'success'
          : 'failed';

    return tasks.filter((task) =>
      activeFilter === 'RUNNING'
        ? task.status === 'running' || task.status === 'monitoring' || task.status === 'processing'
        : task.status === targetStatus,
    );
  }, [activeFilter, tasks]);

  const columns = useMemo<ColumnDef<SupremeTask>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <div className="flex justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer rounded border-white/10 bg-white/5 accent-valor-accent"
              checked={table.getIsAllRowsSelected()}
              onChange={table.getToggleAllRowsSelectedHandler()}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer rounded border-white/10 bg-white/5 accent-valor-accent"
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
          const value = getValue() as string;
          const color =
            value === 'running'
              ? 'text-emerald-400'
              : value === 'processing'
                ? 'text-cyan-300'
              : value === 'success'
                ? 'text-blue-400'
                : value === 'failed'
                  ? 'text-red-400'
                  : value === 'paused'
                    ? 'text-orange-400'
                    : value === 'monitoring'
                      ? 'text-amber-300'
                      : 'text-white/20';

          return (
            <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'h-1.5 w-1.5 rounded-full shadow-[0_0_8px_currentcolor]',
                    value === 'running' || value === 'processing'
                      ? 'bg-current animate-pulse'
                      : 'bg-current opacity-20',
                  )}
                />
              <span className={cn('text-[10px] font-black uppercase italic tracking-tighter', color)}>
                {value}
              </span>
            </div>
          );
        },
        size: 100,
      },
      {
        accessorKey: 'mode',
        header: 'MODE',
        cell: ({ row, getValue }) => {
          const value = getValue() as string;
          const Icon = value === 'fast' ? Zap : value === 'safe' ? Shield : Monitor;
          const checkoutMeta = CHECKOUT_MODE_META[row.original.checkoutMode ?? 'auto'];
          const paymentLabel = PAYMENT_METHOD_META[row.original.paymentMethod ?? 'paypal'].label;

          return (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-white/40 transition-colors group-hover:text-white/60">
                <Icon size={10} />
                <span className="text-[9px] font-bold uppercase tracking-widest">{value}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={cn(
                    'rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.25em]',
                    checkoutMeta.glow,
                    checkoutMeta.accent,
                  )}
                >
                  {checkoutMeta.label}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[8px] font-black uppercase tracking-[0.25em] text-white/45">
                  {paymentLabel}
                </span>
              </div>
            </div>
          );
        },
        size: 150,
      },
      {
        id: 'queue',
        header: 'QUEUE',
        cell: ({ row }) => {
          const task = row.original;
          const isWaiting = task.status === 'waiting' && typeof task.queuedAt === 'number';
          const activeWaitMs = isWaiting ? Math.max(0, currentTime - (task.queuedAt ?? currentTime)) : undefined;
          const queuedAtLabel =
            typeof task.queuedAt === 'number'
              ? new Date(task.queuedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : null;
          const startedAtLabel =
            typeof task.startedAt === 'number'
              ? new Date(task.startedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : null;

          if (isWaiting) {
            return (
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase italic tracking-[0.18em] text-amber-300">
                  In Queue
                </div>
                <div className="font-mono text-[11px] font-black text-white">
                  {formatElapsedDuration(activeWaitMs)}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/25">
                  queued {queuedAtLabel}
                </div>
              </div>
            );
          }

          if (typeof task.waitDurationMs === 'number') {
            return (
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase italic tracking-[0.18em] text-emerald-300">
                  Waited
                </div>
                <div className="font-mono text-[11px] font-black text-white">
                  {formatElapsedDuration(task.waitDurationMs)}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/25">
                  started {startedAtLabel ?? '--'}
                </div>
              </div>
            );
          }

          return (
            <div className="space-y-1">
              <div className="text-[10px] font-black uppercase italic tracking-[0.18em] text-white/25">
                Queue
              </div>
              <div className="font-mono text-[11px] font-black text-white/25">--</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/15">
                no queue delay
              </div>
            </div>
          );
        },
        size: 128,
      },
      {
        header: 'ITEM / KEYWORDS',
        cell: ({ row }) => {
          const task = row.original;
          const primaryLabel =
            task.mode === 'monitor'
              ? task.result?.matchedTitle || task.keywords?.join(', ')
              : task.url
                ? task.url.split('/').pop()?.replace(/-/g, ' ')
                : task.keywords?.join(', ');
          const secondaryLabel =
            task.mode === 'monitor'
              ? task.monitorCategory || task.url || 'KEYWORD MONITOR'
              : task.url || 'KEYWORD MONITOR';
          return (
            <div className="group max-w-[220px] truncate">
              <span className="text-[10px] font-black uppercase italic tracking-tight text-white/80 transition-colors group-hover:text-valor-accent">
                {primaryLabel}
              </span>
              <div className="mt-0.5 truncate font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-white/20">
                {secondaryLabel}
              </div>
              {task.mode === 'monitor' && task.result?.matchedTitle ? (
                <div className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-300/80">
                  {task.result.matchedHandle || 'MATCHED LISTING'}
                </div>
              ) : null}
              {task.mode === 'monitor' && task.result?.matchScore ? (
                <div className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.16em] text-white/20">
                  Score {Math.round(task.result.matchScore)}
                </div>
              ) : null}
              {task.mode === 'monitor' && !task.result?.matchedTitle ? (
                <div className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.16em] text-white/20">
                  {(task.keywords ?? []).join(' / ')}
                </div>
              ) : null}
              {task.mode === 'monitor' && task.monitorCategory ? (
                <div className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.16em] text-amber-200/70">
                  Category {task.monitorCategory}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        header: 'SIZE / COLOR',
        cell: ({ row }) => (
          <span className="text-[10px] font-bold uppercase italic text-white/30">
            {(row.original.size || 'ANY') + ' / ' + (row.original.color || 'ANY')}
          </span>
        ),
        size: 120,
      },
      {
        accessorKey: 'profileId',
        header: 'PROFILE',
        cell: ({ getValue }) => (
          <span className="text-[10px] font-black italic tracking-[0.2em] text-valor-accent">
            {String(getValue()).toUpperCase()}
          </span>
        ),
        size: 100,
      },
      {
        header: 'LAST LOG',
        cell: ({ row }) => (
          <span className="block max-w-[180px] truncate text-[10px] font-medium italic text-white/20">
            {row.original.logs[0] || 'Engine standby...'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex translate-x-2 justify-end gap-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
            {row.original.status === 'processing' && row.original.result?.checkoutUrl ? (
              <button
                onClick={() => void window.electronAPI.openExternal(row.original.result?.checkoutUrl ?? '')}
                className="group/btn rounded-xl p-2.5 text-white/20 transition-colors hover:bg-cyan-500/10 hover:text-cyan-300"
                title="Open Checkout"
              >
                <ExternalLink size={14} className="transition-transform group-active/btn:scale-90" />
              </button>
            ) : null}
            {row.original.mode === 'monitor' && row.original.result?.matchedUrl ? (
              <button
                onClick={() => void window.electronAPI.openExternal(row.original.result?.matchedUrl ?? '')}
                className="group/btn rounded-xl p-2.5 text-white/20 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
                title="Open Matched Product"
              >
                <Monitor size={14} className="transition-transform group-active/btn:scale-90" />
              </button>
            ) : null}
            <button
              onClick={() => handleOpenTaskEdit(row.original)}
              className="group/btn rounded-xl p-2.5 text-white/20 transition-colors hover:bg-white/10 hover:text-white"
              title="Edit Task"
            >
              <Pencil size={14} className="transition-transform group-active/btn:scale-90" />
            </button>
            <button
              onClick={() => setSelectedTaskId(row.original.id)}
              className="group/btn rounded-xl p-2.5 text-white/20 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Terminal size={14} className="transition-transform group-active/btn:scale-90" />
            </button>
            <button
              onClick={() => window.electronAPI.operateTasks('start', [row.original.id])}
              className="group/btn rounded-xl p-2.5 text-white/20 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400"
              title={
                row.original.status === 'processing' &&
                ['paypal_redirect', 'browser_handoff', 'awaiting_action'].includes(
                  row.original.result?.lastStage ?? '',
                )
                  ? 'Resume Verification'
                  : 'Start Task'
              }
            >
              <Play size={14} fill="currentColor" className="transition-transform group-active/btn:scale-90" />
            </button>
            <button
              onClick={() => window.electronAPI.operateTasks('pause', [row.original.id])}
              className="group/btn rounded-xl p-2.5 text-white/20 transition-colors hover:bg-orange-500/10 hover:text-orange-400"
            >
              <Pause size={14} fill="currentColor" className="transition-transform group-active/btn:scale-90" />
            </button>
            <button
              onClick={() => window.electronAPI.operateTasks('cancel', [row.original.id])}
              className="group/btn rounded-xl p-2.5 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={14} className="transition-transform group-active/btn:scale-90" />
            </button>
          </div>
        ),
        size: 120,
      },
    ],
    [currentTime],
  );

  const table = useReactTable({
    data: filteredTasks,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    getRowId: (row) => row.id,
  });

  const selectedCount = Object.keys(rowSelection).length;

  const handleBulkOperate = (action: 'start' | 'pause' | 'cancel' | 'retry') => {
    const ids = Object.keys(rowSelection);
    if (ids.length === 0) {
      return;
    }

    void window.electronAPI.operateTasks(action, ids);
  };

  return (
    <div className="relative flex h-full flex-col space-y-6 animate-in fade-in duration-1000">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <h2 className="text-2xl font-black uppercase tracking-[0.3em] italic text-white leading-none shadow-text">
              Supreme Engine
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-valor-accent shadow-accent-glow animate-pulse" />
              <span className="text-[10px] font-black uppercase italic tracking-[0.4em] text-white/20">
                Local Instance Sync Active
              </span>
            </div>
          </div>

          <div className="h-12 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          <div className="flex rounded-2xl border border-white/5 bg-[#121214] p-1.5 shadow-2xl">
            {(['ALL', 'RUNNING', 'PROCESSING', 'SUCCESS', 'FAILED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setActiveFilter(status)}
                className={cn(
                  'rounded-xl px-6 py-2.5 text-[10px] font-black uppercase italic tracking-widest transition-all',
                  activeFilter === status
                    ? 'bg-valor-accent text-white shadow-lg shadow-valor-accent/30'
                    : 'text-white/20 hover:text-white/60',
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-1.5 shadow-2xl animate-in slide-in-from-right-12 duration-500">
              <span className="px-5 text-[10px] font-black uppercase italic tracking-[0.2em] text-valor-accent">
                {selectedCount} Tasks Locked
              </span>
              <button
                onClick={() => handleBulkOperate('start')}
                className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-6 py-3.5 text-xs font-black uppercase italic tracking-wider text-emerald-400 transition-all hover:bg-emerald-500/20 active:scale-95"
              >
                <Play size={14} fill="currentColor" />
                INITIATE
              </button>
              <button
                onClick={() => handleBulkOperate('cancel')}
                className="flex items-center gap-2 rounded-xl bg-red-500/10 px-6 py-3.5 text-xs font-black uppercase italic tracking-wider text-red-400 transition-all hover:bg-red-500/20 active:scale-95"
              >
                <Trash2 size={14} />
                TERMINATE
              </button>
            </div>
          )}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-4 rounded-[1.25rem] bg-valor-accent px-12 py-5 text-xs font-black uppercase italic tracking-[0.25em] text-white shadow-accent-glow transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={20} strokeWidth={4} />
            NEW SEQUENCE
          </button>
        </div>
      </div>

      <div className="glass-card flex-1 overflow-hidden border-white/5 bg-[#0a0a0b]/40 shadow-3xl backdrop-blur-3xl">
        <div className="h-full overflow-auto custom-scrollbar">
          <table className="w-full table-fixed border-collapse text-left">
            <thead className="sticky top-0 z-10 border-b border-white/5 bg-[#121214]/90 backdrop-blur-2xl">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-8 py-7 text-[11px] font-black uppercase italic tracking-[0.25em] text-white/30"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'group relative cursor-default border-l-4 border-l-transparent transition-all hover:bg-white/[0.04]',
                    row.original.status === 'running' && 'border-l-emerald-400 bg-emerald-500/[0.06]',
                    row.original.status === 'monitoring' && 'border-l-amber-400 bg-amber-500/[0.06]',
                    row.original.status === 'processing' && 'border-l-cyan-300 bg-cyan-500/[0.06]',
                    row.original.status === 'success' && 'border-l-blue-400 bg-blue-500/[0.06]',
                    row.original.status === 'failed' && 'border-l-red-400 bg-red-500/[0.06]',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-8 py-6">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}

              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-56 text-center">
                    <div className="flex flex-col items-center gap-8 opacity-20 animate-pulse">
                      <Terminal size={80} strokeWidth={1} className="text-valor-accent" />
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-black uppercase italic tracking-[0.6em] text-white">
                          Kernel Idle
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                          Awaiting task initialization
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-3xl border border-white/5 bg-white/[0.02] px-8 py-5">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span className="text-[11px] font-black uppercase italic tracking-widest text-white/40">
              Live Engines:{' '}
              <span className="ml-2 font-mono text-white">
                {
                  tasks.filter(
                    (task) =>
                      task.status === 'running' ||
                      task.status === 'monitoring' ||
                      task.status === 'processing',
                  ).length
                }
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" />
            <span className="text-[11px] font-black uppercase italic tracking-widest text-white/40">
              Checkouts: <span className="ml-2 font-mono text-white">{tasks.filter((task) => task.status === 'success').length}</span>
            </span>
          </div>
        </div>
        <div className="flex select-none items-center gap-4 text-[10px] font-black uppercase italic tracking-[0.4em] text-white/10">
          <Zap size={12} fill="currentColor" />
          ANTIGRAVITY SUPREME MODULE SYNC
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-8 backdrop-blur-2xl animate-in fade-in duration-500">
          <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-[3rem] border border-white/10 border-t-white/20 bg-[#0f0f11] shadow-3xl animate-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-transparent to-white/[0.02] p-10">
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <Plus className="text-valor-accent" size={24} strokeWidth={4} />
                  <h3 className="text-2xl font-black uppercase italic tracking-[0.1em] leading-none text-white">
                    Initialize Sequence
                  </h3>
                </div>
                <span className="mt-3 text-[11px] font-bold uppercase tracking-widest text-white/20">
                  Target supreme checkout configuration
                </span>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-2xl p-4 text-white/20 transition-all hover:bg-white/10 hover:text-white active:scale-90"
              >
                <X size={24} />
              </button>
            </div>

            <div className="custom-scrollbar flex-1 space-y-10 overflow-auto p-12">
              <div className="grid grid-cols-3 gap-4">
                {(['fast', 'safe', 'monitor'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setNewTaskMode(mode)}
                    className={cn(
                      'group relative flex flex-col items-center gap-4 overflow-hidden rounded-[2rem] border-2 p-8 transition-all',
                      newTaskMode === mode
                        ? 'border-valor-accent bg-valor-accent/10 shadow-2xl shadow-valor-accent/20'
                        : 'border-transparent bg-white/[0.03] opacity-30 hover:bg-white/[0.06] hover:opacity-100',
                    )}
                  >
                    {newTaskMode === mode && (
                      <div className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-bl-[2rem] bg-valor-accent/20 animate-in slide-in-from-top-4 slide-in-from-right-4">
                        <Zap size={14} className="text-valor-accent" />
                      </div>
                    )}
                    {mode === 'fast' && (
                      <Zap
                        className={cn(
                          'transition-transform group-hover:scale-110',
                          newTaskMode === mode ? 'text-valor-accent' : 'text-white',
                        )}
                        size={28}
                      />
                    )}
                    {mode === 'safe' && (
                      <Shield
                        className={cn(
                          'transition-transform group-hover:scale-110',
                          newTaskMode === mode ? 'text-valor-accent' : 'text-white',
                        )}
                        size={28}
                      />
                    )}
                    {mode === 'monitor' && (
                      <Monitor
                        className={cn(
                          'transition-transform group-hover:scale-110',
                          newTaskMode === mode ? 'text-valor-accent' : 'text-white',
                        )}
                        size={28}
                      />
                    )}
                    <span
                      className={cn(
                        'text-[12px] font-black uppercase italic tracking-widest',
                        newTaskMode === mode ? 'text-valor-accent' : 'text-white',
                      )}
                    >
                      {mode}
                    </span>
                  </button>
                ))}
              </div>

              <div className="space-y-8">
                <div className="group flex flex-col gap-3">
                  <div className="ml-1 flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase italic tracking-[0.2em] text-white/40 transition-colors group-hover:text-valor-accent">
                      {newTaskMode === 'monitor' ? 'Target Keywords' : 'Supreme Product URL'}
                    </label>
                    <AlertCircle size={14} className="text-white/10" />
                  </div>
                  <input
                    type="text"
                    value={inputVal}
                    onChange={(event) => setInputVal(event.target.value)}
                    placeholder={
                      newTaskMode === 'monitor'
                        ? '+keyword, -exclude, keyword'
                        : 'https://www.supremenewyork.com/shop/...'
                    }
                    className="w-full rounded-2xl border border-white/10 bg-[#0a0a0b] p-6 text-sm font-black italic text-white shadow-inner transition-all placeholder:text-white/5 focus:border-valor-accent/50 focus:outline-none"
                  />
                </div>

                {newTaskMode === 'monitor' && (
                  <div className="group flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="ml-1 flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase italic tracking-[0.2em] text-white/40 transition-colors group-hover:text-valor-accent">
                        Monitor Store Root URL
                      </label>
                      <Monitor size={14} className="text-white/10" />
                    </div>
                    <input
                      type="text"
                      value={monitorStoreUrl}
                      onChange={(event) => setMonitorStoreUrl(event.target.value)}
                      placeholder="https://www.supremenewyork.com"
                      className="w-full rounded-2xl border border-white/10 bg-[#0a0a0b] p-6 text-sm font-black italic text-white shadow-inner transition-all placeholder:text-white/5 focus:border-valor-accent/50 focus:outline-none"
                    />
                  </div>
                )}

                {newTaskMode === 'monitor' && (
                  <div className="group flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="ml-1 flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase italic tracking-[0.2em] text-white/40 transition-colors group-hover:text-valor-accent">
                        Monitor Category / Listing Path
                      </label>
                      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/20">
                        tops-sweaters or /shop/all/tops-sweaters
                      </span>
                    </div>
                    <input
                      type="text"
                      value={monitorCategory}
                      onChange={(event) => setMonitorCategory(event.target.value)}
                      placeholder="tops-sweaters"
                      className="w-full rounded-2xl border border-white/10 bg-[#0a0a0b] p-6 text-sm font-black italic text-white shadow-inner transition-all placeholder:text-white/5 focus:border-valor-accent/50 focus:outline-none"
                    />
                  </div>
                )}

                <div className="grid gap-8 xl:grid-cols-[1.35fr_1fr]">
                  <div className="flex flex-col gap-4">
                    <div className="ml-1 flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase italic tracking-[0.2em] text-white/40">
                        Checkout Strategy
                      </label>
                      <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/20">
                        {newTaskMode === 'monitor' ? 'Post-match behavior' : 'Submit behavior'}
                      </span>
                    </div>
                    <div className="grid gap-3">
                      {CHECKOUT_MODE_OPTIONS.map(([mode, meta]) => {
                          const Icon = meta.icon;
                          return (
                            <button
                              key={mode}
                              onClick={() => setSelectedCheckoutMode(mode)}
                              className={cn(
                                'flex items-start justify-between rounded-[1.6rem] border p-5 text-left transition-all',
                                selectedCheckoutMode === mode
                                  ? 'border-valor-accent/40 bg-valor-accent/10 shadow-lg shadow-valor-accent/10'
                                  : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]',
                              )}
                            >
                              <div className="flex flex-col gap-2">
                                <span className={cn('text-[10px] font-black uppercase tracking-[0.3em]', meta.accent)}>
                                  {meta.label}
                                </span>
                                <p className="max-w-[24rem] text-[10px] font-bold leading-relaxed text-white/35">
                                  {meta.description}
                                </p>
                              </div>
                              <div
                                className={cn(
                                  'rounded-2xl border p-3 transition-transform',
                                  meta.glow,
                                  selectedCheckoutMode === mode ? 'scale-100' : 'scale-95 opacity-70',
                                )}
                              >
                                <Icon size={16} className={meta.accent} />
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="ml-1 flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase italic tracking-[0.2em] text-white/40">
                        Payment Rail
                      </label>
                      <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/20">
                        Engine intent
                      </span>
                    </div>
                    <div className="grid gap-3">
                      {PAYMENT_METHOD_OPTIONS.map(([method, meta]) => (
                        <button
                          key={method}
                          onClick={() => setSelectedPaymentMethod(method)}
                          className={cn(
                            'rounded-[1.6rem] border p-5 text-left transition-all',
                            selectedPaymentMethod === method
                              ? 'border-valor-accent/40 bg-white/[0.05]'
                              : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]',
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">
                              {meta.label}
                            </span>
                            <span
                              className={cn(
                                'h-2.5 w-2.5 rounded-full transition-all',
                                selectedPaymentMethod === method ? 'bg-valor-accent shadow-accent-glow' : 'bg-white/10',
                              )}
                            />
                          </div>
                          <p className="mt-3 text-[10px] font-bold leading-relaxed text-white/35">
                            {meta.description}
                          </p>
                        </button>
                      ))}
                    </div>

                    {selectedPaymentMethod === 'card' && selectedCheckoutMode !== 'browser' && (
                      <div className="rounded-[1.4rem] border border-red-400/20 bg-red-500/10 p-4 text-[10px] font-bold leading-relaxed text-red-200/80 animate-in fade-in duration-200">
                        Card automation needs a secure card payload on the assigned profile. If this profile is not
                        vault-ready yet, switch the task to Browser mode or add the card in Profiles first.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="flex flex-col gap-3">
                    <label className="ml-1 text-[11px] font-black uppercase italic tracking-[0.2em] text-white/40">
                      Assigned Profile
                    </label>
                    <select
                      value={selectedProfile}
                      onChange={(event) => setSelectedProfile(event.target.value)}
                      className="cursor-pointer appearance-none rounded-2xl border border-white/10 bg-[#0a0a0b] p-6 text-sm font-black italic text-white transition-all focus:border-valor-accent/50 focus:outline-none"
                    >
                      <option value="default" className="bg-[#0f0f11]">
                        DEFAULT CORE
                      </option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id} className="bg-[#0f0f11] uppercase">
                          {profile.name || profile.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-3">
                    <label className="ml-1 text-[11px] font-black uppercase italic tracking-[0.2em] text-white/40">
                      Variant Selection
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="text"
                        value={size}
                        onChange={(event) => setSize(event.target.value)}
                        placeholder="SIZE"
                        className="rounded-2xl border border-white/10 bg-[#0a0a0b] p-6 text-sm font-black italic text-white transition-all placeholder:text-white/5 focus:border-valor-accent/50 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={color}
                        onChange={(event) => setColor(event.target.value)}
                        placeholder="COLOR"
                        className="rounded-2xl border border-white/10 bg-[#0a0a0b] p-6 text-sm font-black italic text-white transition-all placeholder:text-white/5 focus:border-valor-accent/50 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="ml-1 text-[11px] font-black uppercase italic tracking-[0.2em] text-white/40">
                    Proxy Group
                  </label>
                  <select
                    value={selectedProxyGroup}
                    onChange={(event) => setSelectedProxyGroup(event.target.value)}
                    className="cursor-pointer appearance-none rounded-2xl border border-white/10 bg-[#0a0a0b] p-6 text-sm font-black italic text-white transition-all focus:border-valor-accent/50 focus:outline-none"
                  >
                    <option value="" className="bg-[#0f0f11]">
                      SHARED POOL
                    </option>
                    {proxyGroups.map((group) => (
                      <option key={group.id} value={group.id} className="bg-[#0f0f11] uppercase">
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>

                {newTaskMode === 'monitor' && (
                  <div className="flex flex-col gap-3">
                    <label className="ml-1 text-[11px] font-black uppercase italic tracking-[0.2em] text-white/40">
                      Poll Interval (Seconds)
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={pollIntervalSec}
                      onChange={(event) => setPollIntervalSec(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-[#0a0a0b] p-6 text-sm font-black italic text-white transition-all placeholder:text-white/5 focus:border-valor-accent/50 focus:outline-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'SNIPER', value: '1' },
                        { label: 'BALANCED', value: '2' },
                        { label: 'SAFE', value: '4' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          onClick={() => setPollIntervalSec(preset.value)}
                          className={cn(
                            'rounded-full border px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] transition-all',
                            pollIntervalSec === preset.value
                              ? 'border-amber-300/40 bg-amber-300/10 text-amber-200'
                              : 'border-white/10 bg-white/[0.03] text-white/35 hover:text-white/60',
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/20">
                      Default comes from Settings. Lower intervals catch faster but consume more proxy bandwidth.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/5 bg-white/[0.01] p-10">
              <button
                onClick={handleCreateTask}
                className="w-full rounded-[2rem] bg-valor-accent py-6 text-sm font-black uppercase italic tracking-[0.3em] text-white shadow-accent-glow transition-all hover:-translate-y-1 hover:brightness-110 active:scale-[0.98]"
              >
                Deploy Engine Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[#0f0f11] shadow-3xl">
            <div className="flex items-center justify-between border-b border-white/5 px-8 py-6">
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-[0.18em] text-white">
                  Tune Checkout Strategy
                </h3>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                  Adjust the live checkout path without recreating the task.
                </p>
              </div>
              <button
                onClick={() => setEditingTaskId(null)}
                className="rounded-2xl p-3 text-white/20 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-8">
              <div className="flex flex-col gap-3">
                <label className="ml-1 text-[11px] font-black uppercase italic tracking-[0.2em] text-white/40">
                  Assigned Profile
                </label>
                <select
                  value={editProfileId}
                  onChange={(event) => setEditProfileId(event.target.value)}
                  className="cursor-pointer appearance-none rounded-2xl border border-white/10 bg-[#0a0a0b] p-5 text-sm font-black italic text-white transition-all focus:border-valor-accent/50 focus:outline-none"
                >
                  <option value="default" className="bg-[#0f0f11]">
                    DEFAULT CORE
                  </option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id} className="bg-[#0f0f11] uppercase">
                      {profile.name || profile.id}
                    </option>
                  ))}
                </select>
              </div>

              {tasks.find((candidate) => candidate.id === editingTaskId)?.mode === 'monitor' ? (
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="flex flex-col gap-3">
                    <label className="ml-1 text-[11px] font-black uppercase italic tracking-[0.2em] text-white/40">
                      Monitor Catch Speed
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={editPollIntervalSec}
                      onChange={(event) => setEditPollIntervalSec(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-[#0a0a0b] p-5 text-sm font-black italic text-white transition-all placeholder:text-white/5 focus:border-valor-accent/50 focus:outline-none"
                    />
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/20">
                      Lower intervals poll the category listing more aggressively for faster catches.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="ml-1 text-[11px] font-black uppercase italic tracking-[0.2em] text-white/40">
                      Monitor Category / Listing Path
                    </label>
                    <input
                      type="text"
                      value={editMonitorCategory}
                      onChange={(event) => setEditMonitorCategory(event.target.value)}
                      placeholder="tops-sweaters"
                      className="rounded-2xl border border-white/10 bg-[#0a0a0b] p-5 text-sm font-black italic text-white transition-all placeholder:text-white/5 focus:border-valor-accent/50 focus:outline-none"
                    />
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/20">
                      Update the exact category listing this monitor should watch without recreating the task.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3">
                {CHECKOUT_MODE_OPTIONS.map(([mode, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <button
                      key={mode}
                      onClick={() => setEditCheckoutMode(mode)}
                      className={cn(
                        'flex items-start justify-between rounded-[1.4rem] border p-5 text-left transition-all',
                        editCheckoutMode === mode
                          ? 'border-valor-accent/40 bg-valor-accent/10 shadow-lg shadow-valor-accent/10'
                          : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]',
                      )}
                    >
                      <div className="space-y-2">
                        <span className={cn('text-[10px] font-black uppercase tracking-[0.3em]', meta.accent)}>
                          {meta.label}
                        </span>
                        <p className="text-[10px] font-bold leading-relaxed text-white/35">{meta.description}</p>
                      </div>
                      <div className={cn('rounded-2xl border p-3', meta.glow)}>
                        <Icon size={16} className={meta.accent} />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {PAYMENT_METHOD_OPTIONS.map(([method, meta]) => (
                  <button
                    key={method}
                    onClick={() => setEditPaymentMethod(method)}
                    className={cn(
                      'rounded-[1.4rem] border p-5 text-left transition-all',
                      editPaymentMethod === method
                        ? 'border-valor-accent/40 bg-white/[0.05]'
                        : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">
                        {meta.label}
                      </span>
                      <span
                        className={cn(
                          'h-2.5 w-2.5 rounded-full transition-all',
                          editPaymentMethod === method ? 'bg-valor-accent shadow-accent-glow' : 'bg-white/10',
                        )}
                      />
                    </div>
                    <p className="mt-3 text-[10px] font-bold leading-relaxed text-white/35">{meta.description}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-5 text-[10px] font-bold leading-relaxed text-white/35">
                Card auto or assist mode requires a secure card payload on the assigned profile. Browser mode can still hand off without it.
              </div>
            </div>

            <div className="border-t border-white/5 p-8">
              <button
                onClick={() => void handleSaveTaskEdit()}
                className="w-full rounded-[1.5rem] bg-valor-accent py-5 text-sm font-black uppercase italic tracking-[0.25em] text-white shadow-accent-glow transition-all hover:brightness-110 active:scale-[0.98]"
              >
                Save Task Strategy
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTaskId && (
        <div className="absolute inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-[2px]">
          <button
            aria-label="Close task logs"
            className="flex-1 cursor-default"
            onClick={() => setSelectedTaskId(null)}
          />
          <div className="h-full w-full max-w-[440px] p-4">
            <LogViewer taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
          </div>
        </div>
      )}
    </div>
  );
};
