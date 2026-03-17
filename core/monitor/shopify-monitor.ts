import { createHttpClient } from '../../utils/tls-client';
import { logger } from '../../utils/logger';

export class ShopifyMonitor {
  private url: string;
  private client: any;
  private logger: any;

  constructor(url: string, clientOptions: any) {
    this.url = url;
    this.client = createHttpClient(clientOptions);
    this.logger = logger.child({ component: 'Monitor', url });
  }

  /**
   * GraphQL을 이용한 고속 재고 확인 (v2026 Optimized)
   */
  async checkViaGraphQL(productHandle: string) {
    const query = `
      query getProduct($handle: String!) {
        product(handle: $handle) {
          variants(first: 10) {
            edges {
              node {
                id
                title
                availableForSale
                quantityAvailable
              }
            }
          }
        }
      }
    `;
    
    try {
      const resp = await this.client.post(`${this.url}/api/2026-01/graphql.json`, {
        body: JSON.stringify({ query, variables: { handle: productHandle } }),
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': 'REDACTED_OR_USER_CONFIG'
        }
      });
      return resp.data;
    } catch (err: any) {
      this.logger.error('GraphQL check failed', { error: err.message });
      return null;
    }
  }

  /**
   * WebSocket 기반 실시간 동기화 (지원 스레드 한정)
   */
  async setupWebSocket() {
    this.logger.info('WebSocket inventory stream requested (Experimental 2026)');
    // TODO: Implement WS-based stock shift detection
  }

  async poll(interval: number = 3000) {
    this.logger.info(`Starting hybrid monitor (Poll + GraphQL) on ${this.url}`);
    
    // products.json polling with etag support
    let lastEtag = '';
    
    while (true) {
      try {
        const response = await this.client.get(`${this.url}/products.json?limit=250`, {
          headers: lastEtag ? { 'If-None-Match': lastEtag } : {}
        });

        if (response.status === 200) {
          lastEtag = response.headers['etag'];
          const products = response.data.products;
          this.logger.info(`Detected ${products.length} products via JSON`);
        } else if (response.status === 304) {
          this.logger.debug('No changes in products (304)');
        }

        // Jittered interval
        const jitter = Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, interval + jitter));
      } catch (error: any) {
        this.logger.error('Monitor error', { error: error.message });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}
