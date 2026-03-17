/**
 * @file core/config.ts
 * @description 애플리케이션 설정을 관리하며 Zod를 사용하여 유효성을 검증합니다.
 */

import Store from 'electron-store';
import { z } from 'zod';
import { logger } from '../utils/logger';

// 설정 스키마 정의
export const ConfigSchema = z.object({
  webhookUrl: z.string().url().optional().or(z.literal('')),
  theme: z.enum(['dark', 'light']).default('dark'),
  piscina: z.object({
    maxThreads: z.number().min(1).max(200).default(50),
  }).default({ maxThreads: 50 }),
  notifications: z.boolean().default(true),
});

export type Config = z.infer<typeof ConfigSchema>;

class ConfigManager {
  private store: Store<Config>;

  constructor() {
    this.store = new Store<Config>({
      defaults: ConfigSchema.parse({}),
    });
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.store.get(key);
  }

  set<K extends keyof Config>(key: K, value: Config[K]) {
    try {
      // 값의 유효성 검증
      const partialSchema = ConfigSchema.shape[key];
      partialSchema.parse(value);
      this.store.set(key, value);
    } catch (error: any) {
      logger.error(`Failed to set config: ${key}`, { error: error.message });
      throw error;
    }
  }

  getAll(): Config {
    return this.store.store;
  }
}

export const configManager = new ConfigManager();
