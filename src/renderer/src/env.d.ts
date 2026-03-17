/**
 * @file src/renderer/src/env.d.ts
 * @description Electron API 타입 정의
 */

export interface IElectronAPI {
  getAllTasks: () => Promise<any[]>;
  getTaskStats: () => Promise<any>;
  operateTasks: (action: 'start' | 'pause' | 'cancel' | 'retry', ids: string[]) => Promise<{ success: boolean }>;
  addSupremeTask: (task: any) => Promise<{ success: boolean }>;
  updateSupremeTask: (id: string, updates: any) => Promise<{ success: boolean }>;
  getProfiles: () => Promise<any[]>;
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<void>;
  testWebhook: (url: string) => Promise<void>;
  windowControls: (action: 'minimize' | 'close') => void;
  onTaskStatusChanged: (callback: (data: any) => void) => () => void;
  onTaskLogAppend: (callback: (data: any) => void) => () => void;
  removeAllTaskListeners: () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
