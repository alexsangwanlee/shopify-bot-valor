/**
 * @file core/task/queue.ts
 * @description Supreme 전용 싱글톤 태스크 큐 (워커 스레드 관리 + 지수 백오프 통합)
 */

import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import path from 'path';
import { SupremeTask, TaskStatus, TaskId } from './types';
import { logger } from '../../utils/logger';
import { calculateBackoff, isRetryableError } from './backoff';
import { storage } from '../configManager';
import { taskPool } from './pool';
import { 
  sendSystemNotification, 
  sendDiscordWebhook, 
  formatSupremeSuccessEmbed 
} from '../utils/notification';

export class TaskQueue extends EventEmitter {
  private static instance: TaskQueue;
  
  private queues: {
    high: SupremeTask[];
    normal: SupremeTask[];
    low: SupremeTask[];
  } = { high: [], normal: [], low: [] };

  private runningTasks: Map<TaskId, SupremeTask> = new Map();
  private allTasks: Map<TaskId, SupremeTask> = new Map();
  private abortControllers: Map<TaskId, AbortController> = new Map();

  private maxConcurrent: number = 50;

  private constructor() {
    super();
    
    // Piscina 워커들로부터 오는 전역 메시지 핸들링
    taskPool.on('message', (msg) => {
      if (msg && msg.taskId) {
        this.handleWorkerMessage(msg.taskId, msg);
      }
    });
  }

  public static getInstance(): TaskQueue {
    if (!TaskQueue.instance) {
      TaskQueue.instance = new TaskQueue();
    }
    return TaskQueue.instance;
  }

  public setMaxConcurrent(limit: number) {
    this.maxConcurrent = limit;
    this.tryStartNext();
  }

  public addTask(task: SupremeTask) {
    this.allTasks.set(task.id, task);
    this.enqueue(task);
    this.tryStartNext();
  }

  private enqueue(task: SupremeTask) {
    task.status = 'waiting';
    this.queues[task.priority].push(task);
  }

  public tryStartNext() {
    if (this.runningTasks.size >= this.maxConcurrent) return;

    const nextTask = this.dequeue();
    if (!nextTask) return;

    this.startTask(nextTask);
    this.tryStartNext();
  }

  private dequeue(): SupremeTask | null {
    if (this.queues.high.length > 0) return this.queues.high.shift()!;
    if (this.queues.normal.length > 0) return this.queues.normal.shift()!;
    if (this.queues.low.length > 0) return this.queues.low.shift()!;
    return null;
  }

  /**
   * Piscina 워커 실행
   */
  private async startTask(task: SupremeTask) {
    task.status = 'running';
    this.runningTasks.set(task.id, task);

    const controller = new AbortController();
    this.abortControllers.set(task.id, controller);

    this.emit('task:status', { id: task.id, status: 'running' });

    try {
      // Piscina는 메시지 포트를 통해 통신할 수 있음 (또는 parentPort 활용)
      // 여기서는 기존 worker.ts의 parentPort.postMessage를 받기 위해 
      // Piscina의 'message' 이벤트를 전역으로 구독하거나 각 스레드 생성 시 처리
      // Piscina v4+ 에서는 pool.on('message', ...) 로 가능
      
      const result = await taskPool.run(
        { taskId: task.id, task: task },
        { signal: controller.signal }
      );

      // 성공 시 처리 (return 값 활용 가능)
      if (result && result.success) {
        // 이미 handleWorkerMessage에서 처리되었을 수 있음
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        logger.info(`TaskQueue: Task [${task.id}] aborted by user.`);
      } else {
        logger.error(`TaskQueue: Piscina error [${task.id}]`, { error: err.message });
        this.retryOrFail(task, err);
      }
    } finally {
      this.abortControllers.delete(task.id);
      this.runningTasks.delete(task.id);
      this.tryStartNext();
    }
  }

  private handleWorkerMessage(taskId: TaskId, msg: any) {
    const task = this.allTasks.get(taskId);
    if (!task) return;

    switch (msg.type) {
      case 'log':
        task.logs.unshift(msg.payload);
        if (task.logs.length > 80) task.logs.pop();
        this.emit('task:log', { id: taskId, log: msg.payload });
        break;
      case 'status':
        task.status = msg.payload as TaskStatus;
        this.emit('task:status', { id: taskId, status: task.status });
        break;
      case 'success':
        task.status = 'success';
        task.result = msg.payload;
        this.emit('task:status', { id: taskId, status: 'success', result: task.result });
        
        // Phase 10: 알림 및 웹훅 발송
        this.triggerSuccessNotifications(task);
        break;
      case 'error':
        this.retryOrFail(task, new Error(msg.payload.message));
        break;
    }
  }

  /**
   * 재시도 및 실패 로직 (Exponential Backoff 적용)
   */
  private retryOrFail(task: SupremeTask, error?: Error) {
    const errorMessage = error?.message || task.lastError || 'Unknown error';
    this.terminateWorker(task.id);
    
    if (task.maxRetries > 0 && isRetryableError(errorMessage)) {
      task.maxRetries--;
      
      const delay = calculateBackoff(5 - task.maxRetries);
      const logMsg = `[RETRY] Attempt scheduled in ${Math.floor(delay)}ms. Reason: ${errorMessage}`;
      
      task.logs.unshift(logMsg);
      task.status = 'waiting';
      this.emit('task:status', { id: task.id, status: 'waiting' });
      this.emit('task:log', { id: task.id, log: logMsg });

      setTimeout(() => {
        if (task.status === 'waiting') {
          this.enqueue(task);
          this.tryStartNext();
        }
      }, delay);
      
    } else {
      task.status = 'failed';
      task.lastError = errorMessage;
      const logMsg = `[FATAL] Task failed: ${errorMessage}`;
      task.logs.unshift(logMsg);
      this.emit('task:status', { id: task.id, status: 'failed', error: task.lastError });
      this.emit('task:log', { id: task.id, log: logMsg });
      this.tryStartNext();
    }
  }

  public pauseTask(id: TaskId) {
    const task = this.allTasks.get(id);
    if (!task) return;

    this.terminateWorker(id);
    task.status = 'paused';
    this.runningTasks.delete(id);
    this.emit('task:status', { id, status: 'paused' });
    this.tryStartNext();
  }

  public cancelTask(id: TaskId) {
    const task = this.allTasks.get(id);
    if (!task) return;

    this.terminateWorker(id);
    this.runningTasks.delete(id);
    this.removeFromQueues(id);
    task.status = 'cancelled';
    this.emit('task:status', { id, status: 'cancelled' });
    this.tryStartNext();
  }

  public retryTask(id: TaskId) {
    const task = this.allTasks.get(id);
    if (!task) return;

    this.terminateWorker(id);
    task.status = 'waiting';
    this.runningTasks.delete(id);
    this.enqueue(task);
    this.tryStartNext();
  }

  public updateTask(id: TaskId, updates: Partial<SupremeTask>) {
    const task = this.allTasks.get(id);
    if (!task) return;

    Object.assign(task, updates);
    this.emit('task:status', { id, status: task.status, result: task.result });
  }

  private terminateWorker(id: TaskId) {
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }
  }

  public cleanupAll() {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
    taskPool.destroy();
    logger.info('TaskQueue: All Piscina workers terminated during cleanup.');
  }

  private removeFromQueues(id: TaskId) {
    this.queues.high = this.queues.high.filter(t => t.id !== id);
    this.queues.normal = this.queues.normal.filter(t => t.id !== id);
    this.queues.low = this.queues.low.filter(t => t.id !== id);
  }

  public getAllTasks(): SupremeTask[] {
    return Array.from(this.allTasks.values());
  }

  public getStats() {
    const all = Array.from(this.allTasks.values());
    return {
      total: all.length,
      running: this.runningTasks.size,
      waiting: all.filter(t => t.status === 'waiting').length,
      success: all.filter(t => t.status === 'success').length,
      failed: all.filter(t => t.status === 'failed').length,
    };
  }

  private async triggerSuccessNotifications(task: SupremeTask) {
    try {
      const config = await storage.loadConfig();
      
      if (config.notificationsEnabled) {
        sendSystemNotification('Supreme Success!', `Order placed for ${task.url || 'Keywords Match'}`);
      }

      if (config.webhookUrl) {
        const embed = formatSupremeSuccessEmbed(task);
        sendDiscordWebhook(config.webhookUrl, embed);
      }
    } catch (err: any) {
      logger.error('TaskQueue: Failed to send notifications', { error: err.message });
    }
  }
}

export const taskQueue = TaskQueue.getInstance();
