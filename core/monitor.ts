/**
 * @file core/monitor.ts
 * @description Shopify 스토어의 제품 변동사항을 모니터링합니다.
 */

import { ShopifyMonitor } from './monitor/shopify-monitor';
import { z } from 'zod';
import { logger } from '../utils/logger';

export const MonitorConfigSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  keywords: z.array(z.string()),
  interval: z.number().min(1000).default(3000),
  proxyGroup: z.string().optional(),
});

export type MonitorConfig = z.infer<typeof MonitorConfigSchema>;

export class GlobalMonitor {
  private monitors: Map<string, ShopifyMonitor> = new Map();

  startMonitor(config: MonitorConfig) {
    try {
      MonitorConfigSchema.parse(config);
      
      const monitor = new ShopifyMonitor(config.url, {
        // fingerprint 등 기본 옵션 필요
        fingerprint: { ja3: '...', http2: '...' } 
      });

      this.monitors.set(config.id, monitor);
      monitor.poll(config.interval);
      logger.info(`Monitor started for ${config.url}`);
    } catch (error: any) {
      logger.error('Failed to start monitor', { error: error.message });
      throw error;
    }
  }

  stopMonitor(id: string) {
    // ShopifyMonitor에 stop 로직 구현 필요
    this.monitors.delete(id);
    logger.info(`Monitor stopped: ${id}`);
  }
}

export const globalMonitor = new GlobalMonitor();
