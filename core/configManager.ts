/**
 * @file core/configManager.ts
 * @description Supreme 전용 데이터 저장 및 로드 관리 (Atomic Write + JSON Persistence)
 */

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { SupremeTask } from './task/types';
import { logger } from '../utils/logger';

export interface AppConfig {
  webhookUrl: string;
  maxConcurrent: number;
  autoSaveInterval: number;
  notificationsEnabled: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  webhookUrl: '',
  maxConcurrent: 50,
  autoSaveInterval: 30,
  notificationsEnabled: true,
};

export class ConfigManager {
  private static instance: ConfigManager;
  private basePath: string;

  private constructor() {
    // Electron userData 폴더 활용
    this.basePath = app.getPath('userData');
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private getPath(filename: string): string {
    return path.join(this.basePath, filename);
  }

  /**
   * JSON 파일 로드
   */
  public async loadPayload<T>(filename: string, defaultValue: T): Promise<T> {
    const filePath = this.getPath(filename);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (error) {
      return defaultValue;
    }
  }

  /**
   * JSON 파일 저장 (Atomic Write)
   */
  public async savePayload<T>(filename: string, data: T): Promise<void> {
    const filePath = this.getPath(filename);
    const tempPath = `${filePath}.tmp`;
    try {
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error: any) {
      logger.error(`ConfigManager: Failed to save ${filename}`, { error: error.message });
    }
  }

  /**
   * 앱 시작 시 태스크 복구
   */
  public async recoverTasks(): Promise<SupremeTask[]> {
    const tasks = await this.loadPayload<SupremeTask[]>('tasks.json', []);
    return tasks.map(t => {
      // 실행 중이었던 태스크는 'waiting' 또는 'paused'로 강제 변경
      if (t.status === 'running' || t.status === 'monitoring') {
        return { ...t, status: 'waiting' };
      }
      return t;
    });
  }

  public async loadConfig(): Promise<AppConfig> {
    return this.loadPayload<AppConfig>('config.json', DEFAULT_CONFIG);
  }

  public async saveConfig(config: AppConfig): Promise<void> {
    await this.savePayload('config.json', config);
  }
}

export const storage = ConfigManager.getInstance();
