/**
 * @file core/task/runner.ts
 * @description Piscina와 우선순위 큐를 이용한 태스크 통합 관리 시스템 (IPC 연동 추가)
 */

import Piscina from 'piscina';
import path from 'path';
import os from 'os';
import { BrowserWindow } from 'electron';
import { logger } from '../../utils/logger';
import { PriorityQueue } from './queue';
import { TaskData, TaskState, TaskStatusType } from './models';
import { shouldRetry, calculateRetryDelay } from './retry';

class TaskRunner {
  private pool: Piscina;
  private queue: PriorityQueue = new PriorityQueue();
  private tasks: Map<string, TaskState> = new Map();
  private activeCount: number = 0;
  private maxConcurrency: number = 50;

  constructor() {
    const threadCount = Math.floor(os.cpus().length * 1.5);
    this.pool = new Piscina({
      filename: path.resolve(__dirname, 'worker.ts'),
      minThreads: Math.max(1, Math.floor(threadCount / 2)),
      maxThreads: threadCount,
    });
    
    logger.info(`TaskRunner: Piscina pool initialized with up to ${threadCount} threads.`);
  }

  async addTask(data: TaskData) {
    const taskId = data.id;
    this.tasks.set(taskId, {
      id: taskId,
      status: 'queued',
      message: 'Waiting in queue...',
      retryCount: 0,
      lastUpdate: Date.now(),
    });

    this.queue.enqueue(data);
    this.updateStatus(taskId, 'queued', 'Waiting in queue...');
    this.processQueue();
  }

  private async processQueue() {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const taskData = this.queue.dequeue();
    if (!taskData) return;

    this.executeTask(taskData);
    this.processQueue();
  }

  private async executeTask(data: TaskData, retryCount: number = 0) {
    const taskId = data.id;
    this.activeCount++;
    
    this.updateStatus(taskId, 'running', 'Task is executing...');

    try {
      // 워커에 태스크 전달 및 결과 대기
      const result = await this.pool.run(data);
      
      this.activeCount--;

      if (result.success) {
        this.updateStatus(taskId, 'success', 'Task completed successfully!');
        this.broadcastLog(taskId, 'Checkout successful!', 'success');
      } else {
        await this.handleTaskFailure(data, retryCount, result.error);
      }

    } catch (error: any) {
      this.activeCount--;
      await this.handleTaskFailure(data, retryCount, error);
    } finally {
      this.processQueue();
    }
  }

  private async handleTaskFailure(data: TaskData, retryCount: number, error: any) {
    const taskId = data.id;

    if (shouldRetry(data, retryCount, error)) {
      const delay = calculateRetryDelay(data, retryCount);
      const msg = `Retrying in ${Math.round(delay/1000)}s... (Attempts: ${retryCount + 1})`;
      this.updateStatus(taskId, 'retrying', msg);
      this.broadcastLog(taskId, `Retry triggered: ${error.message || error}`, 'warning');
      
      setTimeout(() => {
        this.executeTask(data, retryCount + 1);
      }, delay);
    } else {
      this.updateStatus(taskId, 'failed', `Error: ${error.message || error}`);
      this.broadcastLog(taskId, `Task failed: ${error.message || error}`, 'error');
    }
  }

  /**
   * 상태 변화를 렌더러로 브로드캐스트합니다.
   */
  private updateStatus(id: string, status: TaskStatusType, message: string) {
    const existing = this.tasks.get(id);
    if (!existing) return;

    const newState: TaskState = {
      ...existing,
      status,
      message,
      lastUpdate: Date.now(),
    };
    this.tasks.set(id, newState);
    
    // IPC 브로드캐스트
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.send('task-update', newState);
    }
    
    logger.debug(`Task State Update [${id}]: ${status} - ${message}`);
  }

  /**
   * 실시간 로그를 렌더러로 브로드캐스트합니다.
   */
  private broadcastLog(taskId: string, message: string, level: 'info' | 'success' | 'warning' | 'error') {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.send('task-log', {
        taskId,
        message,
        level,
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false })
      });
    }
  }

  getStatus(id: string): TaskState | undefined {
    return this.tasks.get(id);
  }

  stopTask(id: string) {
    this.queue.remove(id);
    this.updateStatus(id, 'stopped', 'Task stopped manually.');
    this.broadcastLog(id, 'Task manual stop signal received.', 'info');
  }
}

export const taskRunner = new TaskRunner();
