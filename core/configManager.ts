import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { StoredAppConfig } from './app-data';
import { SupremeTask } from './task/types';
import { logger } from '../utils/logger';

export interface AppConfig extends StoredAppConfig {}

export const DEFAULT_APP_CONFIG: AppConfig = {
  webhookUrl: '',
  maxConcurrent: 50,
  autoSaveInterval: 30,
  notificationsEnabled: true,
  processingRecheckIntervalSec: 5,
  processingMaxChecks: 24,
  monitorDefaultPollIntervalSec: 2,
  proxySpeedTestUrl: 'https://www.supremenewyork.com/shop/all',
};

export class ConfigManager {
  private static instance: ConfigManager;
  private basePath: string;

  private constructor() {
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

  public async loadPayload<T>(filename: string, defaultValue: T): Promise<T> {
    const filePath = this.getPath(filename);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.info(`ConfigManager: ${filename} not found, using default value`);
        return defaultValue;
      }
      
      // If file exists but is corrupted, log error and backup if possible
      logger.error(`ConfigManager: Critical error loading ${filename}`, { 
        error: error.message,
        code: error.code 
      });
      
      // Return default value as fallback to keep app running, but don't silency swallow
      return defaultValue;
    }
  }

  public async savePayload<T>(filename: string, data: T): Promise<void> {
    const filePath = this.getPath(filename);
    const tempPath = `${filePath}.tmp`;

    try {
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      const saveError = error as Error;
      logger.error(`ConfigManager: Failed to save ${filename}`, { error: saveError.message });
      throw saveError;
    }
  }

  public async recoverTasks(): Promise<SupremeTask[]> {
    const tasks = await this.loadPayload<SupremeTask[]>('tasks.json', []);

    return tasks.map((task) => {
      if (task.status === 'running') {
        return { ...task, status: 'waiting' };
      }

      if (task.status === 'monitoring') {
        return { ...task, status: 'monitoring' };
      }

      return task;
    });
  }

  public async loadConfig(): Promise<AppConfig> {
    const config = await this.loadPayload<Partial<AppConfig>>('config.json', DEFAULT_APP_CONFIG);
    return {
      ...DEFAULT_APP_CONFIG,
      ...config,
    };
  }

  public async saveConfig(config: AppConfig): Promise<void> {
    await this.savePayload('config.json', config);
  }
}

export const storage = ConfigManager.getInstance();
