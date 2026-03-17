/**
 * @file src/renderer/src/stores/useTaskStore.ts
 * @description Supreme 전용 Zustand 스토어
 */

import { create } from 'zustand';
import { SupremeTask, TaskId } from '../../../core/task/types';

interface TaskStats {
  total: number;
  running: number;
  waiting: number;
  success: number;
  failed: number;
}

interface TaskStore {
  tasks: SupremeTask[];
  stats: TaskStats;
  
  // Actions
  setTasks: (tasks: SupremeTask[]) => void;
  updateTask: (id: TaskId, updates: Partial<SupremeTask>) => void;
  addLog: (id: TaskId, log: string) => void;
  setStats: (stats: TaskStats) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  stats: { total: 0, running: 0, waiting: 0, success: 0, failed: 0 },

  setTasks: (tasks) => set({ tasks }),

  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
  })),

  addLog: (id, log) => set((state) => ({
    tasks: state.tasks.map(t => {
      if (t.id === id) {
        const newLogs = [log, ...t.logs].slice(0, 80);
        return { ...t, logs: newLogs };
      }
      return t;
    })
  })),

  setStats: (stats) => set({ stats }),
}));
