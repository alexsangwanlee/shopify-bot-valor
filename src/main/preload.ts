import { contextBridge, ipcRenderer } from 'electron';
import type { TaskLogPayload, TaskStatsPayload, TaskStatusPayload } from '../../core/ipc/contracts';

const TASK_STATUS_CHANNEL = 'task-status-changed';
const TASK_LOG_CHANNEL = 'task-log-append';

contextBridge.exposeInMainWorld('electronAPI', {
  getAllTasks: () => ipcRenderer.invoke('tasks:get-all'),
  getTaskStats: (): Promise<TaskStatsPayload> => ipcRenderer.invoke('tasks:get-stats'),
  operateTasks: (action: 'start' | 'pause' | 'cancel' | 'retry', ids: string[]) =>
    ipcRenderer.invoke('tasks:operate', { action, ids }),
  addSupremeTask: (task: unknown) => ipcRenderer.invoke('tasks:add', task),
  updateSupremeTask: (id: string, updates: unknown) =>
    ipcRenderer.invoke('tasks:update', { id, updates }),
  clearTaskLogs: (id: string) => ipcRenderer.invoke('tasks:clear-logs', id),

  getProfiles: () => ipcRenderer.invoke('profiles:get-all'),
  saveProfiles: (profiles: unknown[]) => ipcRenderer.invoke('profiles:save-all', profiles),
  importProfilesCsv: () => ipcRenderer.invoke('profiles:import-csv'),
  exportProfilesCsv: () => ipcRenderer.invoke('profiles:export-csv'),

  getProxyGroups: () => ipcRenderer.invoke('proxies:get-all'),
  createProxyGroup: (payload: { name: string; rawInput: string }) =>
    ipcRenderer.invoke('proxies:create-group', payload),
  removeProxyGroup: (id: string) => ipcRenderer.invoke('proxies:remove-group', id),
  validateProxyGroups: () => ipcRenderer.invoke('proxies:validate-all'),
  testProxySpeeds: (payload?: { groupId?: string; targetUrl?: string }) =>
    ipcRenderer.invoke('proxies:test-speed', payload),

  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config: unknown) => ipcRenderer.invoke('config:save', config),
  testWebhook: (url: string) => ipcRenderer.invoke('webhook:test', url),

  exportAppData: () => ipcRenderer.invoke('app-data:export'),
  importAppData: () => ipcRenderer.invoke('app-data:import'),
  wipeAppData: () => ipcRenderer.invoke('app-data:wipe'),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),

  windowControls: (action: 'minimize' | 'close') => ipcRenderer.send('window-controls', action),

  onTaskStatusChanged: (callback: (data: TaskStatusPayload) => void) => {
    const subscription = (_event: unknown, data: TaskStatusPayload) => callback(data);
    ipcRenderer.on(TASK_STATUS_CHANNEL, subscription);
    return () => ipcRenderer.removeListener(TASK_STATUS_CHANNEL, subscription);
  },

  onTaskLogAppend: (callback: (data: TaskLogPayload) => void) => {
    const subscription = (_event: unknown, data: TaskLogPayload) => callback(data);
    ipcRenderer.on(TASK_LOG_CHANNEL, subscription);
    return () => ipcRenderer.removeListener(TASK_LOG_CHANNEL, subscription);
  },

  removeAllTaskListeners: () => {
    ipcRenderer.removeAllListeners(TASK_STATUS_CHANNEL);
    ipcRenderer.removeAllListeners(TASK_LOG_CHANNEL);
  },
});
