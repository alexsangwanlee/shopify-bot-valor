/**
 * @file src/renderer/src/stores/taskStore.ts
 * @description Zustand를 사용한 실시간 태스크 및 로그 상태 관리
 */

import { create } from 'zustand';
import { TaskData, TaskState } from '../../../../core/task/models';

interface LogEntry {
  taskId: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

interface TaskStore {
  tasks: Map<string, TaskData>;
  taskStates: Map<string, TaskState>;
  logs: Map<string, LogEntry[]>;
  globalStats: {
    success: number;
    failed: number;
    running: number;
  };

  // Actions
  setTask: (id: string, data: TaskData) => void;
  updateTaskState: (id: string, state: TaskState) => void;
  addLog: (entry: LogEntry) => void;
  clearLogs: (taskId: string) => void;
  bulkUpdateTasks: (updates: Partial<TaskData>[]) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: new Map(),
  taskStates: new Map(),
  logs: new Map(),
  globalStats: {
    success: 0,
    failed: 0,
    running: 0,
  },

  setTask: (id: string, data: TaskData) => set((state: TaskStore) => {
    const newTasks = new Map(state.tasks);
    newTasks.set(id, data);
    return { tasks: newTasks };
  }),

  updateTaskState: (id: string, taskState: TaskState) => set((state: TaskStore) => {
    const newTaskStates = new Map(state.taskStates);
    newTaskStates.set(id, taskState);
    
    const stats = { ...state.globalStats };
    if (taskState.status === 'success') stats.success += 1;
    if (taskState.status === 'failed') stats.failed += 1;
    
    stats.running = Array.from(newTaskStates.values()).filter((s: any) => s.status === 'running').length;

    return { taskStates: newTaskStates, globalStats: stats };
  }),

  addLog: (entry: LogEntry) => set((state: TaskStore) => {
    const newLogs = new Map(state.logs);
    const taskLogs = newLogs.get(entry.taskId) || [];
    
    const updatedTaskLogs = [entry, ...taskLogs].slice(0, 500);
    newLogs.set(entry.taskId, updatedTaskLogs);
    
    return { logs: newLogs };
  }),

  clearLogs: (taskId: string) => set((state: TaskStore) => {
    const newLogs = new Map(state.logs);
    newLogs.delete(taskId);
    return { logs: newLogs };
  }),

  bulkUpdateTasks: (updates: Partial<TaskData>[]) => set((state: TaskStore) => {
    const newTasks = new Map(state.tasks);
    updates.forEach((update: any) => {
      if (update.id) {
        const existing = newTasks.get(update.id);
        if (existing) newTasks.set(update.id, { ...existing, ...update } as TaskData);
      }
    });
    return { tasks: newTasks };
  }),
}));
