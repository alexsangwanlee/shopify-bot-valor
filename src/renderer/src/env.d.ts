import { BillingProfile, BillingProfileInput, ProxyGroup, StoredAppConfig } from '@core/app-data';
import { SupremeTask } from '@core/task/types';
import { TaskLogPayload, TaskStatsPayload, TaskStatusPayload } from '@core/ipc/contracts';

type TaskOperation = 'start' | 'pause' | 'cancel' | 'retry';

interface MutationResult<T = undefined> {
  success: boolean;
  canceled?: boolean;
  error?: string;
  task?: SupremeTask;
  profiles?: BillingProfile[];
  groups?: ProxyGroup[];
  importedCount?: number;
  exportedCount?: number;
  filePath?: string;
  counts?: {
    tasks: number;
    profiles: number;
    proxyGroups: number;
  };
  data?: T;
}

export interface IElectronAPI {
  getAllTasks: () => Promise<SupremeTask[]>;
  getTaskStats: () => Promise<TaskStatsPayload>;
  operateTasks: (action: TaskOperation, ids: string[]) => Promise<MutationResult>;
  addSupremeTask: (task: unknown) => Promise<MutationResult>;
  updateSupremeTask: (id: string, updates: unknown) => Promise<MutationResult>;

  getProfiles: () => Promise<BillingProfile[]>;
  saveProfiles: (profiles: BillingProfileInput[]) => Promise<MutationResult>;
  importProfilesCsv: () => Promise<MutationResult>;
  exportProfilesCsv: () => Promise<MutationResult>;

  getProxyGroups: () => Promise<ProxyGroup[]>;
  createProxyGroup: (payload: { name: string; rawInput: string }) => Promise<MutationResult>;
  removeProxyGroup: (id: string) => Promise<MutationResult>;
  validateProxyGroups: () => Promise<MutationResult>;
  testProxySpeeds: (payload?: { groupId?: string; targetUrl?: string }) => Promise<MutationResult>;

  getConfig: () => Promise<StoredAppConfig>;
  saveConfig: (config: StoredAppConfig) => Promise<MutationResult>;
  testWebhook: (url: string) => Promise<MutationResult>;

  exportAppData: () => Promise<MutationResult>;
  importAppData: () => Promise<MutationResult>;
  wipeAppData: () => Promise<MutationResult>;
  openExternal: (url: string) => Promise<MutationResult>;

  windowControls: (action: 'minimize' | 'close') => void;
  clearTaskLogs: (id: string) => Promise<MutationResult>;
  onTaskStatusChanged: (callback: (data: TaskStatusPayload) => void) => () => void;
  onTaskLogAppend: (callback: (data: TaskLogPayload) => void) => () => void;
  removeAllTaskListeners: () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
