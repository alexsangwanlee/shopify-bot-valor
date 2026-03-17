import { create } from 'zustand';
import { SupremeTask, TaskId } from '@core/task/types';

interface TaskStats {
  total: number;
  running: number;
  waiting: number;
  success: number;
  failed: number;
  processing: number;
}

interface TaskStore {
  tasks: SupremeTask[];
  stats: TaskStats;
  setTasks: (tasks: SupremeTask[]) => void;
  updateTask: (id: TaskId, updates: Partial<SupremeTask>) => void;
  addLog: (id: TaskId, log: string) => void;
  clearTaskLogs: (id: TaskId) => Promise<void>;
  setStats: (stats: TaskStats) => void;
}

function calculateStats(tasks: SupremeTask[]): TaskStats {
  return {
    total: tasks.length,
    running: tasks.filter((task) => task.status === 'running' || task.status === 'monitoring').length,
    waiting: tasks.filter((task) => task.status === 'waiting').length,
    success: tasks.filter((task) => task.status === 'success').length,
    failed: tasks.filter((task) => task.status === 'failed').length,
    processing: tasks.filter((task) => task.status === 'processing').length,
  };
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  stats: { total: 0, running: 0, waiting: 0, success: 0, failed: 0, processing: 0 },
  setTasks: (tasks) => set({ tasks, stats: calculateStats(tasks) }),
  updateTask: (id, updates) =>
    set((state) => {
      const tasks = state.tasks.map((task) =>
        task.id === id ? ({ ...task, ...updates } as SupremeTask) : task,
      );
      return { tasks, stats: calculateStats(tasks) };
    }),
  addLog: (id, log) =>
    set((state) => ({
      tasks: state.tasks.map((task) => {
        if (task.id === id) {
          const nextLogs = [log, ...(task.logs ?? [])].slice(0, 80);
          return { ...task, logs: nextLogs } as SupremeTask;
        }

        return task;
      }),
    })),
  clearTaskLogs: async (id) => {
    try {
      await window.electronAPI.clearTaskLogs(id);
      set((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === id ? ({ ...task, logs: [] } as SupremeTask) : task,
        ),
      }));
    } catch (error) {
      console.error('Failed to clear persistent logs:', error);
    }
  },
  setStats: (stats) => set({ stats }),
}));
