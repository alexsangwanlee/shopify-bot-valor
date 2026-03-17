/**
 * @file src/main/preload.ts
 * @description Supreme 전용 프리로드 스크립트 (IPC 통신 노출)
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Task Operations
  getAllTasks: () => ipcRenderer.invoke('tasks:get-all'),
  getTaskStats: () => ipcRenderer.invoke('tasks:get-stats'),
  operateTasks: (action: 'start' | 'pause' | 'cancel' | 'retry', ids: string[]) => 
    ipcRenderer.invoke('tasks:operate', { action, ids }),
  addSupremeTask: (task: any) => ipcRenderer.invoke('tasks:add', task),
  updateSupremeTask: (id: string, updates: any) => ipcRenderer.invoke('tasks:update', { id, updates }),
  getProfiles: () => ipcRenderer.invoke('profiles:get-all'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config: any) => ipcRenderer.invoke('config:save', config),
  testWebhook: (url: string) => ipcRenderer.invoke('webhook:test', url),
  
  // Window Controls
  windowControls: (action: 'minimize' | 'close') => ipcRenderer.send('window-controls', action),
  
  // Real-time Listeners
  onTaskStatusChanged: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('task-status-changed', subscription);
    return () => ipcRenderer.removeListener('task-status-changed', subscription);
  },

  onTaskLogAppend: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('task-log-append', subscription);
    return () => ipcRenderer.removeListener('task-log-append', subscription);
  },

  // Cleanup helper
  removeAllTaskListeners: () => {
    ipcRenderer.removeAllListeners('task-status-changed');
    ipcRenderer.removeAllListeners('task-log-append');
  }
});
