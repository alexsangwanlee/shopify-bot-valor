import type { TaskId, TaskStatus, SupremeTask } from '../task/types';

export interface TaskStatsPayload {
  total: number;
  running: number;
  waiting: number;
  success: number;
  failed: number;
  processing: number;
}

export interface TaskStatusPayload {
  id: TaskId;
  status: TaskStatus;
  queuedAt?: SupremeTask['queuedAt'];
  startedAt?: SupremeTask['startedAt'];
  waitDurationMs?: SupremeTask['waitDurationMs'];
  result?: SupremeTask['result'];
  error?: string;
}

export interface TaskLogPayload {
  id: TaskId;
  log: string;
}
