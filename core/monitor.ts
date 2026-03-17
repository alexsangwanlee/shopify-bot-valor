import { z } from 'zod';
import { logger } from '../utils/logger';
import { ShopifyMonitor } from './monitor/shopify-monitor';

export const MonitorConfigSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  keywords: z.array(z.string()),
  interval: z.number().min(1000).default(3000),
  proxyGroup: z.string().optional(),
});

export type MonitorConfig = z.infer<typeof MonitorConfigSchema>;

type ActiveMonitor = {
  monitor: ShopifyMonitor;
  controller: AbortController;
  promise: Promise<void>;
};

export class GlobalMonitor {
  private monitors: Map<string, ActiveMonitor> = new Map();

  startMonitor(config: MonitorConfig) {
    const parsedConfig = MonitorConfigSchema.parse(config);
    this.stopMonitor(parsedConfig.id);

    const controller = new AbortController();
    const monitor = new ShopifyMonitor(parsedConfig.url, {});
    const promise = monitor
      .poll(parsedConfig.interval, { signal: controller.signal })
      .catch((error) => {
        const monitorError = error as Error;
        if (monitorError.name === 'AbortError') {
          logger.info(`Monitor aborted: ${parsedConfig.id}`);
          return;
        }

        logger.error('Monitor stopped with error', {
          id: parsedConfig.id,
          error: monitorError.message,
        });
      })
      .finally(() => {
        this.monitors.delete(parsedConfig.id);
      });

    this.monitors.set(parsedConfig.id, {
      monitor,
      controller,
      promise,
    });

    logger.info(`Monitor started for ${parsedConfig.url}`);
  }

  stopMonitor(id: string) {
    const activeMonitor = this.monitors.get(id);
    if (!activeMonitor) {
      return;
    }

    activeMonitor.controller.abort();
    activeMonitor.monitor.stop();
    this.monitors.delete(id);
    logger.info(`Monitor stopped: ${id}`);
  }

  stopAll() {
    for (const id of this.monitors.keys()) {
      this.stopMonitor(id);
    }
  }
}

export const globalMonitor = new GlobalMonitor();
