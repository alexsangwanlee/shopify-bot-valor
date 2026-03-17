import { createHttpClient } from '../../utils/tls-client';
import { logger } from '../../utils/logger';

type PollOptions = {
  signal?: AbortSignal;
  onProducts?: (products: any[]) => void;
};

export class ShopifyMonitor {
  private url: string;
  private client: any;
  private logger: any;
  private stopped = false;

  constructor(url: string, clientOptions: any) {
    this.url = url;
    this.client = createHttpClient(clientOptions);
    this.logger = logger.child({ component: 'Monitor', url });
  }

  public stop() {
    this.stopped = true;
  }

  public async poll(interval: number = 3000, options: PollOptions = {}) {
    const { signal, onProducts } = options;
    let lastEtag = '';

    this.stopped = false;
    this.logger.info(`Starting products.json monitor on ${this.url}`);

    while (!this.stopped && !signal?.aborted) {
      try {
        const response = await this.client.get(`${this.url}/products.json?limit=250`, {
          headers: lastEtag ? { 'If-None-Match': lastEtag } : {},
          followRedirects: true
        });

        if (response.status === 200) {
          lastEtag = response.headers['etag'];
          const payload = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
          const products = payload.products ?? [];
          this.logger.info(`Fetched ${products.length} products via JSON feed`);
          onProducts?.(products);
        } else if (response.status === 304) {
          this.logger.debug('No changes detected in products feed (304)');
        }

        await this.wait(interval, signal);
      } catch (error) {
        const monitorError = error as Error;
        if (signal?.aborted || this.stopped) {
          break;
        }

        this.logger.error('Monitor poll failed', { error: monitorError.message });
        await this.wait(Math.min(interval * 2, 10_000), signal);
      }
    }
  }

  private wait(ms: number, signal?: AbortSignal) {
    if (signal?.aborted || this.stopped) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve();
      }, ms);

      const onAbort = () => {
        clearTimeout(timeout);
        cleanup();
        resolve();
      };

      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort);
      };

      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}
