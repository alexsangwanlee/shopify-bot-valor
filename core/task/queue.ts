import { EventEmitter } from 'events';
import { safeStorage } from 'electron';
import type { TaskLogPayload, TaskStatsPayload, TaskStatusPayload } from '../ipc/contracts';
import type { BillingCardPayload, ResolvedBillingProfile, StoredBillingProfile } from '../app-data';
import { logger } from '../../utils/logger';
import { storage } from '../configManager';
import { proxyManager } from '../proxy/manager';
import { calculateBackoff, isRetryableError } from './backoff';
import { taskPool } from './pool';
import { SupremeTask, TaskId, TaskStatus } from './types';
import {
  formatSupremeFailureEmbed,
  formatSupremeSuccessEmbed,
  sendDiscordWebhook,
  sendSystemNotification,
} from '../utils/notification';

type TaskPoolMessage = {
  taskId: TaskId;
  type: 'log' | 'status' | 'success' | 'error' | 'processing';
  payload: any;
  timestamp: number;
};

type MonitorCycleResult = {
  continueMonitoring: boolean;
  monitorHitsDelta: number;
  lastHeartbeatAt: number;
  matchFound?: boolean;
  variantId?: string;
  matchedTitle?: string;
  matchedHandle?: string;
  matchedUrl?: string;
  matchedCategory?: string;
  matchScore?: number;
};

function decryptSecureCard(payload?: string): BillingCardPayload | undefined {
  if (!payload) {
    return undefined;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS secure storage is unavailable on this machine');
  }

  return JSON.parse(safeStorage.decryptString(Buffer.from(payload, 'base64'))) as BillingCardPayload;
}

function resolveWorkerProfile(profile: StoredBillingProfile): ResolvedBillingProfile {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    address1: profile.address1,
    city: profile.city,
    phone: profile.phone,
    province: profile.province,
    zip: profile.zip,
    country: profile.country,
    captchaApiKey: profile.captchaApiKey,
    cardBrand: profile.cardBrand,
    last4: profile.last4,
    cardHolder: profile.cardHolder,
    expiryMonth: profile.expiryMonth,
    expiryYear: profile.expiryYear,
    hasSecureCard: Boolean(profile.secureCardPayload),
    validated: profile.validated,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    secureCard: decryptSecureCard(profile.secureCardPayload),
  };
}

export class TaskQueue extends EventEmitter {
  private static instance: TaskQueue;

  private queues: Record<'high' | 'normal' | 'low', SupremeTask[]> = {
    high: [],
    normal: [],
    low: [],
  };

  private runningTasks = new Map<TaskId, SupremeTask>();
  private allTasks = new Map<TaskId, SupremeTask>();
  private abortControllers = new Map<TaskId, AbortController>();
  private retryTimers = new Map<TaskId, NodeJS.Timeout>();
  private monitorTimers = new Map<TaskId, NodeJS.Timeout>();
  private processingTimers = new Map<TaskId, NodeJS.Timeout>();
  private maxConcurrent = 50;
  private processingRecheckIntervalMs = 5_000;
  private processingMaxChecks = 24;

  private constructor() {
    super();

    taskPool.on('message', (message) => {
      if (message && typeof message === 'object' && 'taskId' in message) {
        this.handleWorkerMessage(message as TaskPoolMessage);
      }
    });
  }

  public static getInstance() {
    if (!TaskQueue.instance) {
      TaskQueue.instance = new TaskQueue();
    }

    return TaskQueue.instance;
  }

  public setMaxConcurrent(limit: number) {
    this.maxConcurrent = Math.max(1, limit);
    this.tryStartNext();
  }

  public setProcessingPolicy(intervalSec: number, maxChecks: number) {
    this.processingRecheckIntervalMs = Math.max(1, intervalSec) * 1000;
    this.processingMaxChecks = Math.max(1, maxChecks);
  }

  public restoreTasks(tasks: SupremeTask[]) {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }

    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }

    for (const timer of this.monitorTimers.values()) {
      clearTimeout(timer);
    }

    proxyManager.clearSessions();
    this.queues = { high: [], normal: [], low: [] };
    this.runningTasks.clear();
    this.abortControllers.clear();
    this.retryTimers.clear();
    this.monitorTimers.clear();
    this.processingTimers.clear();
    this.allTasks.clear();

    for (const task of tasks) {
      const normalizedTask = this.normalizeTask(task);

      this.allTasks.set(normalizedTask.id, normalizedTask);

      if (normalizedTask.status === 'monitoring') {
        this.scheduleMonitorCycle(normalizedTask, 0);
      } else if (this.shouldAutoRecheck(normalizedTask)) {
        this.scheduleProcessingCheck(normalizedTask, 0);
      } else if (normalizedTask.status === 'waiting') {
        this.enqueue(normalizedTask);
      }
    }

    this.tryStartNext();
  }

  public addTask(task: SupremeTask) {
    const normalizedTask = this.normalizeTask(task);

    this.allTasks.set(normalizedTask.id, normalizedTask);
    this.enqueue(normalizedTask);
    this.tryStartNext();
  }

  public resumeTask(id: TaskId) {
    const task = this.allTasks.get(id);
    if (!task) {
      return;
    }

    this.clearRetryTimer(id);
    this.clearMonitorTimer(id);
    this.clearProcessingTimer(id);
    this.removeFromQueues(id);
    this.runningTasks.delete(id);

    if (task.status === 'processing' && task.result?.checkoutUrl) {
      task.lastError = undefined;
      this.emit('task:status', {
        id,
        status: 'processing',
        queuedAt: task.queuedAt,
        startedAt: task.startedAt,
        waitDurationMs: task.waitDurationMs,
        result: task.result,
      });
      this.scheduleProcessingCheck(task, 0);
      this.tryStartNext();
      return;
    }

    if (task.mode === 'monitor') {
      task.status = 'monitoring';
      task.queuedAt = undefined;
      task.startedAt = task.startedAt ?? Date.now();
      task.waitDurationMs = undefined;
      this.emit('task:status', {
        id,
        status: 'monitoring',
        queuedAt: task.queuedAt,
        startedAt: task.startedAt,
        waitDurationMs: task.waitDurationMs,
        result: task.result,
      });
      this.scheduleMonitorCycle(task, 0);
      this.tryStartNext();
      return;
    }

    if (task.status === 'paused' || task.status === 'cancelled' || task.status === 'waiting') {
      this.enqueue(task);
      this.tryStartNext();
    }
  }

  public getAllTasks() {
    return Array.from(this.allTasks.values());
  }

  public getStats(): TaskStatsPayload {
    const allTasks = Array.from(this.allTasks.values());
    return {
      total: allTasks.length,
      running: allTasks.filter((task) => task.status === 'running' || task.status === 'monitoring')
        .length,
      waiting: allTasks.filter((task) => task.status === 'waiting').length,
      success: allTasks.filter((task) => task.status === 'success').length,
      failed: allTasks.filter((task) => task.status === 'failed').length,
      processing: allTasks.filter((task) => task.status === 'processing').length,
    };
  }

  public updateTask(id: TaskId, updates: Partial<SupremeTask>) {
    const task = this.allTasks.get(id);
    if (!task) {
      return;
    }

    Object.assign(task, updates);

    if (task.mode === 'monitor' && task.status === 'monitoring') {
      this.clearMonitorTimer(id);
      if (!this.runningTasks.has(id)) {
        this.scheduleMonitorCycle(task, 0);
      }
    }

    this.emit('task:status', {
      id,
      status: task.status,
      queuedAt: task.queuedAt,
      startedAt: task.startedAt,
      waitDurationMs: task.waitDurationMs,
      result: task.result,
    });
  }

  public clearTaskLogs(id: TaskId) {
    const task = this.allTasks.get(id);
    if (!task) return;
    task.logs = [];
    this.emit('task:status', {
      id,
      status: task.status,
      queuedAt: task.queuedAt,
      startedAt: task.startedAt,
      waitDurationMs: task.waitDurationMs,
      result: task.result,
    });
  }

  public pauseTask(id: TaskId) {
    const task = this.allTasks.get(id);
    if (!task) {
      return;
    }

    this.clearRetryTimer(id);
    this.clearMonitorTimer(id);
    this.clearProcessingTimer(id);
    this.terminateWorker(id);
    this.removeFromQueues(id);
    this.runningTasks.delete(id);
    proxyManager.releaseSession(id);

    task.status = 'paused';
    this.emit('task:status', {
      id,
      status: 'paused',
      queuedAt: task.queuedAt,
      startedAt: task.startedAt,
      waitDurationMs: task.waitDurationMs,
      result: task.result,
    });
    this.tryStartNext();
  }

  public cancelTask(id: TaskId) {
    const task = this.allTasks.get(id);
    if (!task) {
      return;
    }

    this.clearRetryTimer(id);
    this.clearMonitorTimer(id);
    this.clearProcessingTimer(id);
    this.terminateWorker(id);
    this.removeFromQueues(id);
    this.runningTasks.delete(id);
    proxyManager.releaseSession(id);

    task.status = 'cancelled';
    this.emit('task:status', {
      id,
      status: 'cancelled',
      queuedAt: task.queuedAt,
      startedAt: task.startedAt,
      waitDurationMs: task.waitDurationMs,
      result: task.result,
    });
    this.tryStartNext();
  }

  public retryTask(id: TaskId) {
    const task = this.allTasks.get(id);
    if (!task) {
      return;
    }

    this.clearRetryTimer(id);
    this.clearMonitorTimer(id);
    this.clearProcessingTimer(id);
    this.terminateWorker(id);
    this.removeFromQueues(id);
    this.runningTasks.delete(id);

    task.retryCount = 0;
    task.lastError = undefined;
    task.result = undefined;
    task.startedAt = undefined;
    task.waitDurationMs = undefined;

    if (task.mode === 'monitor') {
      task.status = 'monitoring';
      task.queuedAt = undefined;
      this.emit('task:status', {
        id,
        status: 'monitoring',
        queuedAt: task.queuedAt,
        startedAt: task.startedAt,
        waitDurationMs: task.waitDurationMs,
        result: task.result,
      });
      this.scheduleMonitorCycle(task, 0);
    } else {
      this.enqueue(task);
    }

    this.tryStartNext();
  }

  public async cleanupAll() {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }

    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }

    for (const timer of this.monitorTimers.values()) {
      clearTimeout(timer);
    }

    for (const timer of this.processingTimers.values()) {
      clearTimeout(timer);
    }

    this.abortControllers.clear();
    this.retryTimers.clear();
    this.monitorTimers.clear();
    this.processingTimers.clear();
    proxyManager.clearSessions();
    await taskPool.destroy();
    logger.info('TaskQueue: all Piscina workers terminated during cleanup.');
  }

  private enqueue(task: SupremeTask) {
    this.clearRetryTimer(task.id);
    this.clearMonitorTimer(task.id);
    this.clearProcessingTimer(task.id);
    this.removeFromQueues(task.id);

    task.status = 'waiting';
    task.lastError = undefined;
    task.queuedAt = Date.now();
    task.startedAt = undefined;
    task.waitDurationMs = undefined;
    this.queues[task.priority].push(task);
    this.emit('task:status', {
      id: task.id,
      status: 'waiting',
      queuedAt: task.queuedAt,
      startedAt: task.startedAt,
      waitDurationMs: task.waitDurationMs,
      result: task.result,
    });
  }

  public tryStartNext() {
    while (this.runningTasks.size < this.maxConcurrent) {
      const nextTask = this.dequeue();
      if (!nextTask) {
        break;
      }

      void this.startTask(nextTask);
    }
  }

  private dequeue() {
    if (this.queues.high.length > 0) {
      return this.queues.high.shift() ?? null;
    }

    if (this.queues.normal.length > 0) {
      return this.queues.normal.shift() ?? null;
    }

    if (this.queues.low.length > 0) {
      return this.queues.low.shift() ?? null;
    }

    return null;
  }

  private async startTask(task: SupremeTask) {
    if (this.runningTasks.has(task.id)) {
      return;
    }

    if (task.status === 'paused' || task.status === 'cancelled' || task.status === 'failed') {
      return;
    }

    this.clearRetryTimer(task.id);
    this.clearMonitorTimer(task.id);
    this.clearProcessingTimer(task.id);

    const now = Date.now();
    const initialStatus: TaskStatus =
      task.status === 'processing' ? 'processing' : task.mode === 'monitor' ? 'monitoring' : 'running';
    const proxyUrl = proxyManager.getProxy(task.id, task.proxyGroup);

    if (initialStatus === 'running') {
      task.startedAt = now;
      task.waitDurationMs =
        typeof task.queuedAt === 'number' ? Math.max(0, now - task.queuedAt) : task.waitDurationMs;
    } else if (initialStatus === 'monitoring') {
      task.queuedAt = undefined;
      task.startedAt = now;
      task.waitDurationMs = undefined;
    }

    task.status = initialStatus;
    this.runningTasks.set(task.id, task);

    const controller = new AbortController();
    this.abortControllers.set(task.id, controller);

    this.emit('task:status', {
      id: task.id,
      status: initialStatus,
      queuedAt: task.queuedAt,
      startedAt: task.startedAt,
      waitDurationMs: task.waitDurationMs,
      result: task.result,
    });

    try {
      // Resolve Profile Info
      const profiles = await storage.loadPayload<StoredBillingProfile[]>('profiles.json', []);
      const profile = profiles.find((candidate) => candidate.id === task.profileId);
      const resolvedProfile = profile ? resolveWorkerProfile(profile) : undefined;

      const result = (await taskPool.run(
        {
          taskId: task.id,
          task,
          proxyUrl,
          profile: resolvedProfile,
        },
        { signal: controller.signal },
      )) as MonitorCycleResult | undefined;

      if (task.mode === 'monitor') {
        this.handleMonitorCycleComplete(task, result);
      }
    } catch (error) {
      const taskError = error as Error & { name?: string };
      if (taskError.name === 'AbortError') {
        logger.info(`TaskQueue: task [${task.id}] aborted.`);
      } else {
        logger.error(`TaskQueue: Piscina error [${task.id}]`, { error: taskError.message });
        this.retryOrFail(task, taskError);
      }
    } finally {
      this.abortControllers.delete(task.id);
      this.runningTasks.delete(task.id);
      this.tryStartNext();
    }
  }

  private handleWorkerMessage(message: TaskPoolMessage) {
    const task = this.allTasks.get(message.taskId);
    if (!task) {
      return;
    }

    switch (message.type) {
      case 'log':
        this.appendLog(task, String(message.payload));
        this.emit('task:log', { id: message.taskId, log: String(message.payload) } satisfies TaskLogPayload);
        break;
      case 'status':
        task.status = message.payload as TaskStatus;
        this.emit(
          'task:status',
          {
            id: message.taskId,
            status: task.status,
            queuedAt: task.queuedAt,
            startedAt: task.startedAt,
            waitDurationMs: task.waitDurationMs,
            result: task.result,
          } satisfies TaskStatusPayload,
        );
        break;
      case 'success':
        task.status = 'success';
        task.retryCount = 0;
        task.lastError = undefined;
        task.result = {
          ...(task.result ?? {}),
          ...(message.payload ?? {}),
        };
        proxyManager.markSuccess(task.id);
        proxyManager.releaseSession(task.id);
        this.emit(
          'task:status',
          {
            id: message.taskId,
            status: 'success',
            queuedAt: task.queuedAt,
            startedAt: task.startedAt,
            waitDurationMs: task.waitDurationMs,
            result: task.result,
          } satisfies TaskStatusPayload,
        );
        void this.triggerSuccessNotifications(task);
        break;
      case 'error':
        this.retryOrFail(task, new Error(message.payload?.message ?? 'Unknown worker error'));
        break;
      case 'processing':
        task.status = 'processing';
        const processingChecks = (task.result?.processingChecks ?? 0) + 1;
        task.result = {
          ...(task.result ?? {}),
          ...(message.payload ?? {}),
          processingChecks,
        };
        proxyManager.releaseSession(message.taskId);
        if (processingChecks >= this.processingMaxChecks) {
          task.status = 'failed';
          task.lastError = `Processing confirmation timed out after ${this.processingMaxChecks} checks`;
          const logMessage = `[FATAL] ${task.lastError}`;
          this.appendLog(task, logMessage);
          this.emit('task:status', {
            id: message.taskId,
            status: 'failed',
            queuedAt: task.queuedAt,
            startedAt: task.startedAt,
            waitDurationMs: task.waitDurationMs,
            result: task.result,
            error: task.lastError,
          });
          this.emit('task:log', { id: message.taskId, log: logMessage });
          void this.triggerFailureNotifications(task);
          break;
        }
        this.emit(
          'task:status',
          {
            id: message.taskId,
            status: 'processing',
            queuedAt: task.queuedAt,
            startedAt: task.startedAt,
            waitDurationMs: task.waitDurationMs,
            result: task.result,
          } satisfies TaskStatusPayload,
        );
        if (this.shouldAutoRecheck(task)) {
          this.scheduleProcessingCheck(task, this.processingRecheckIntervalMs);
        }
        break;
    }
  }

  private retryOrFail(task: SupremeTask, error?: Error) {
    const errorMessage = error?.message ?? task.lastError ?? 'Unknown error';
    const lowercaseMessage = errorMessage.toLowerCase();

    this.clearRetryTimer(task.id);
    this.clearMonitorTimer(task.id);
    this.clearProcessingTimer(task.id);
    this.terminateWorker(task.id);
    proxyManager.markFailure(task.id, errorMessage);

    if (task.retryCount < task.maxRetries && isRetryableError(errorMessage)) {
      task.retryCount += 1;

      if (lowercaseMessage.includes('timeout') || lowercaseMessage.includes('network')) {
        proxyManager.failover(task.id, task.proxyGroup);
      }

      const delay = calculateBackoff(task.retryCount, task.retryDelayMs);
      const logMessage = `[RETRY] Attempt ${task.retryCount}/${task.maxRetries} scheduled in ${Math.floor(
        delay,
      )}ms. Reason: ${errorMessage}`;

      task.lastError = errorMessage;
      this.appendLog(task, logMessage);

      const retryTimer = setTimeout(() => {
        this.retryTimers.delete(task.id);

        if (task.mode === 'monitor') {
          if (task.status === 'monitoring') {
            if (this.runningTasks.size < this.maxConcurrent) {
              void this.startTask(task);
            } else {
              this.scheduleMonitorCycle(task, 500);
            }
          }
          return;
        }

        if (task.status === 'waiting') {
          this.enqueue(task);
          this.tryStartNext();
        }
      }, delay);

      if (task.mode === 'monitor') {
        task.status = 'monitoring';
        task.queuedAt = undefined;
        task.startedAt = task.startedAt ?? Date.now();
        task.waitDurationMs = undefined;
        this.emit('task:status', {
          id: task.id,
          status: 'monitoring',
          queuedAt: task.queuedAt,
          startedAt: task.startedAt,
          waitDurationMs: task.waitDurationMs,
          result: task.result,
        });
      } else {
        task.status = 'waiting';
        task.queuedAt = Date.now();
        task.startedAt = undefined;
        task.waitDurationMs = undefined;
        this.emit('task:status', {
          id: task.id,
          status: 'waiting',
          queuedAt: task.queuedAt,
          startedAt: task.startedAt,
          waitDurationMs: task.waitDurationMs,
          result: task.result,
        });
      }

      this.emit('task:log', { id: task.id, log: logMessage });
      this.retryTimers.set(task.id, retryTimer);
      return;
    }

    task.status = 'failed';
    task.lastError = errorMessage;
    proxyManager.releaseSession(task.id);

    const logMessage = `[FATAL] Task failed: ${errorMessage}`;
    this.appendLog(task, logMessage);

    this.emit('task:status', {
      id: task.id,
      status: 'failed',
      queuedAt: task.queuedAt,
      startedAt: task.startedAt,
      waitDurationMs: task.waitDurationMs,
      error: task.lastError,
      result: task.result,
    });
    this.emit('task:log', { id: task.id, log: logMessage });
    void this.triggerFailureNotifications(task);
  }

  private terminateWorker(id: TaskId) {
    const controller = this.abortControllers.get(id);
    if (!controller) {
      return;
    }

    controller.abort();
    this.abortControllers.delete(id);
  }

  private clearRetryTimer(id: TaskId) {
    const retryTimer = this.retryTimers.get(id);
    if (!retryTimer) {
      return;
    }

    clearTimeout(retryTimer);
    this.retryTimers.delete(id);
  }

  private clearMonitorTimer(id: TaskId) {
    const monitorTimer = this.monitorTimers.get(id);
    if (!monitorTimer) {
      return;
    }

    clearTimeout(monitorTimer);
    this.monitorTimers.delete(id);
  }

  private clearProcessingTimer(id: TaskId) {
    const processingTimer = this.processingTimers.get(id);
    if (!processingTimer) {
      return;
    }

    clearTimeout(processingTimer);
    this.processingTimers.delete(id);
  }

  private appendLog(task: SupremeTask, message: string) {
    task.logs.unshift(message);
    task.logs = task.logs.slice(0, 80);
  }

  private removeFromQueues(id: TaskId) {
    this.queues.high = this.queues.high.filter((task) => task.id !== id);
    this.queues.normal = this.queues.normal.filter((task) => task.id !== id);
    this.queues.low = this.queues.low.filter((task) => task.id !== id);
  }

  private normalizeTask(task: SupremeTask): SupremeTask {
    return {
      ...task,
      retryCount: task.retryCount ?? 0,
      logs: task.logs ?? [],
      pollIntervalMs: task.pollIntervalMs ?? 3_000,
      queuedAt: task.queuedAt ?? (task.status === 'waiting' ? Date.now() : undefined),
      startedAt: task.startedAt,
      waitDurationMs: task.waitDurationMs,
      paymentMethod: task.paymentMethod ?? 'card', // Ensure default for old JSON payloads
      checkoutMode: task.checkoutMode ?? 'auto',
      styleCode: task.styleCode || undefined,
      sizePreference: task.sizePreference || [],
      result: task.result
        ? {
            ...task.result,
            processingChecks: task.result.processingChecks ?? 0,
          }
        : undefined,
    } as SupremeTask;
  }

  private handleMonitorCycleComplete(task: SupremeTask, result?: MonitorCycleResult) {
    if (task.status !== 'monitoring') {
      return;
    }

    const nextResult = {
      ...(task.result ?? {}),
      monitorHits: (task.result?.monitorHits ?? 0) + (result?.monitorHitsDelta ?? 0),
      lastHeartbeatAt: result?.lastHeartbeatAt ?? Date.now(),
      lastStage: 'monitoring',
      variantId: result?.variantId ?? task.result?.variantId,
      matchedTitle: result?.matchedTitle ?? task.result?.matchedTitle,
      matchedHandle: result?.matchedHandle ?? task.result?.matchedHandle,
      matchedUrl: result?.matchedUrl ?? task.result?.matchedUrl,
      matchedCategory: result?.matchedCategory ?? task.result?.matchedCategory,
      matchScore: result?.matchScore ?? task.result?.matchScore,
    };

    task.retryCount = 0;
    task.lastError = undefined;
    task.result = nextResult;

    proxyManager.markSuccess(task.id);

    // Auto-Transition Logic: If match found, switch mode and enqueue
    if (result?.matchFound && result.variantId) {
      logger.info(`[MONITOR] Match found! Transitioning ${task.id} to checkout mode.`);
      this.appendLog(
        task,
        `[MONITOR] Match found: ${result.matchedTitle ?? result.variantId} (${result.variantId}). Transitioning to checkout.`,
      );
      
      const { keywords, ...baseTask } = task;
      // If task.url already points to products.json or has trailing slash, handle it
      const baseUrl = task.url.replace(/\/products\.json$/, '').replace(/\/$/, '');
      
      const updatedTask = {
        ...baseTask,
        mode: 'safe' as const,
        url: `${baseUrl}/variants/${result.variantId}`,
        status: 'waiting' as const,
        result: nextResult
      } as SupremeTask;

      this.allTasks.set(task.id, updatedTask);
      this.emit('task:status', {
        id: task.id,
        status: 'waiting',
        queuedAt: updatedTask.queuedAt,
        startedAt: updatedTask.startedAt,
        waitDurationMs: updatedTask.waitDurationMs,
        result: updatedTask.result,
      });
      this.enqueue(updatedTask);
      this.tryStartNext();
      return;
    }

    this.emit('task:status', {
      id: task.id,
      status: 'monitoring',
      queuedAt: task.queuedAt,
      startedAt: task.startedAt,
      waitDurationMs: task.waitDurationMs,
      result: task.result,
    });
    this.scheduleMonitorCycle(task, task.pollIntervalMs);
  }

  private scheduleMonitorCycle(task: SupremeTask, delayMs: number) {
    if (task.mode !== 'monitor') {
      return;
    }

    if (task.status === 'paused' || task.status === 'cancelled' || task.status === 'failed') {
      return;
    }

    this.clearMonitorTimer(task.id);
    task.status = 'monitoring';

    const timer = setTimeout(() => {
      this.monitorTimers.delete(task.id);

      if (task.status !== 'monitoring' || this.runningTasks.has(task.id)) {
        return;
      }

      if (this.runningTasks.size >= this.maxConcurrent) {
        this.scheduleMonitorCycle(task, 500);
        return;
      }

      void this.startTask(task);
    }, Math.max(0, delayMs));

    this.monitorTimers.set(task.id, timer);
  }

  private scheduleProcessingCheck(task: SupremeTask, delayMs: number) {
    if (task.status !== 'processing' || !task.result?.checkoutUrl) {
      return;
    }

    this.clearProcessingTimer(task.id);

    const timer = setTimeout(() => {
      this.processingTimers.delete(task.id);

      if (task.status !== 'processing' || this.runningTasks.has(task.id)) {
        return;
      }

      if (this.runningTasks.size >= this.maxConcurrent) {
        this.scheduleProcessingCheck(task, 2_000);
        return;
      }

      void this.startTask(task);
    }, Math.max(0, delayMs));

    this.processingTimers.set(task.id, timer);
  }

  private shouldAutoRecheck(task: SupremeTask) {
    return (
      task.status === 'processing' &&
      task.checkoutMode === 'auto' &&
      Boolean(task.result?.checkoutUrl) &&
      !['paypal_redirect', 'browser_handoff', 'awaiting_action'].includes(task.result?.lastStage ?? '')
    );
  }

  private async triggerSuccessNotifications(task: SupremeTask) {
    try {
      const config = await storage.loadConfig();

      if (config.notificationsEnabled) {
        await sendSystemNotification(
          'Supreme Success',
          `Order placed for ${task.url ?? 'Keywords Match'}`,
        );
      }

      if (config.webhookUrl) {
        const embed = formatSupremeSuccessEmbed(task);
        await sendDiscordWebhook(config.webhookUrl, embed);
      }
    } catch (error) {
      logger.error('TaskQueue: failed to send success notifications', { error });
    }
  }

  private async triggerFailureNotifications(task: SupremeTask) {
    try {
      const config = await storage.loadConfig();

      if (config.notificationsEnabled) {
        await sendSystemNotification(
          'Supreme Failure',
          task.lastError
            ? `Checkout failed: ${task.lastError}`
            : `Checkout failed for ${task.url ?? 'Keywords Match'}`,
        );
      }

      if (config.webhookUrl) {
        const embed = formatSupremeFailureEmbed(task);
        await sendDiscordWebhook(config.webhookUrl, embed);
      }
    } catch (error) {
      logger.error('TaskQueue: failed to send failure notifications', { error });
    }
  }
}

export const taskQueue = TaskQueue.getInstance();
