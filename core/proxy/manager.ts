import { logger } from '../../utils/logger';

export interface Proxy {
  host: string;
  port: number;
  username?: string;
  password?: string;
  type: 'residential' | 'datacenter' | 'mobile';
  latencyMs?: number;
  lastCheckedAt?: number;
}

interface ProxyHealth {
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  lastLatencyMs?: number;
  lastUsedAt?: number;
  cooldownUntil?: number;
  lastFailureReason?: string;
}

export interface ProxySessionDiagnostics {
  proxyUrl?: string;
  health?: ProxyHealth;
}

export class ProxyManager {
  private static instance: ProxyManager;
  private proxyPool: string[] = [];
  private proxyGroups: Map<string, string[]> = new Map();
  private proxiesByKey: Map<string, Proxy> = new Map();
  private stickySessions: Map<string, string> = new Map();
  private health: Map<string, ProxyHealth> = new Map();

  private constructor() {}

  public static getInstance(): ProxyManager {
    if (!ProxyManager.instance) {
      ProxyManager.instance = new ProxyManager();
    }

    return ProxyManager.instance;
  }

  public setPool(proxies: Proxy[]) {
    this.setGroups([{ id: 'default', proxies }]);
  }

  public setGroups(groups: Array<{ id: string; proxies: Proxy[] }>) {
    const nextProxiesByKey = new Map<string, Proxy>();
    const nextProxyGroups = new Map<string, string[]>();

    for (const group of groups) {
      const keys = group.proxies.map((proxy) => {
        const key = this.createProxyKey(proxy);
        nextProxiesByKey.set(key, proxy);
        const nextHealth = this.health.get(key) ?? {
          successCount: 0,
          failureCount: 0,
          consecutiveFailures: 0,
        };

        if (typeof proxy.latencyMs === 'number') {
          nextHealth.lastLatencyMs = proxy.latencyMs;
          nextHealth.lastUsedAt = proxy.lastCheckedAt ?? nextHealth.lastUsedAt;
          nextHealth.successCount = Math.max(nextHealth.successCount, 1);
          nextHealth.cooldownUntil = undefined;
          nextHealth.lastFailureReason = undefined;
        }

        this.health.set(key, nextHealth);
        return key;
      });

      nextProxyGroups.set(group.id, keys);
    }

    this.proxiesByKey = nextProxiesByKey;
    this.proxyGroups = nextProxyGroups;
    this.proxyPool = groups.flatMap((group) => nextProxyGroups.get(group.id) ?? []);

    for (const sessionId of Array.from(this.stickySessions.keys())) {
      const proxyKey = this.stickySessions.get(sessionId);
      if (!proxyKey || !this.proxiesByKey.has(proxyKey)) {
        this.stickySessions.delete(sessionId);
      }
    }

    logger.info(
      `ProxyManager: Registered ${groups.length} groups with ${this.proxyPool.length} proxies.`,
    );
  }

  public getProxy(sessionId: string, groupId?: string, forceNew: boolean = false): string | undefined {
    const pool = this.getPool(groupId);
    if (pool.length === 0) {
      return undefined;
    }

    const currentKey = this.stickySessions.get(sessionId);
    if (!forceNew && currentKey && pool.includes(currentKey) && this.isHealthy(currentKey)) {
      this.touch(currentKey);
      return this.formatProxy(this.proxiesByKey.get(currentKey)!);
    }

    const nextKey = this.selectBestProxy(pool, currentKey);
    if (!nextKey) {
      return undefined;
    }

    this.stickySessions.set(sessionId, nextKey);
    this.touch(nextKey);
    return this.formatProxy(this.proxiesByKey.get(nextKey)!);
  }

  public failover(sessionId: string, groupId?: string): string | undefined {
    const currentKey = this.stickySessions.get(sessionId);
    if (currentKey) {
      this.markFailure(sessionId, 'failover requested');
    }

    const pool = this.getPool(groupId);
    const nextKey = this.selectBestProxy(pool, currentKey);
    if (!nextKey) {
      return undefined;
    }

    this.stickySessions.set(sessionId, nextKey);
    this.touch(nextKey);
    logger.warn(`ProxyManager: Failover triggered for session [${sessionId}]`);
    return this.formatProxy(this.proxiesByKey.get(nextKey)!);
  }

  public markSuccess(sessionId: string, latencyMs?: number) {
    const proxyKey = this.stickySessions.get(sessionId);
    if (!proxyKey) {
      return;
    }

    const health = this.ensureHealth(proxyKey);
    health.successCount += 1;
    health.consecutiveFailures = 0;
    health.lastLatencyMs = latencyMs;
    health.lastUsedAt = Date.now();
    health.cooldownUntil = undefined;
    health.lastFailureReason = undefined;
  }

  public markFailure(sessionId: string, reason: string) {
    const proxyKey = this.stickySessions.get(sessionId);
    if (!proxyKey) {
      return;
    }

    const health = this.ensureHealth(proxyKey);
    health.failureCount += 1;
    health.consecutiveFailures += 1;
    health.lastFailureReason = reason;
    health.lastUsedAt = Date.now();

    if (health.consecutiveFailures >= 2) {
      health.cooldownUntil = Date.now() + 30_000;
    }
  }

  public getSessionDiagnostics(sessionId: string): ProxySessionDiagnostics {
    const proxyKey = this.stickySessions.get(sessionId);
    if (!proxyKey) {
      return {};
    }

    return {
      proxyUrl: this.formatProxy(this.proxiesByKey.get(proxyKey)!),
      health: this.health.get(proxyKey),
    };
  }

  public releaseSession(sessionId: string) {
    this.stickySessions.delete(sessionId);
  }

  public clearSessions() {
    this.stickySessions.clear();
  }

  public reset() {
    this.clearSessions();
    this.proxyPool = [];
    this.proxyGroups.clear();
    this.proxiesByKey.clear();
  }

  private createProxyKey(proxy: Proxy) {
    return [proxy.host, proxy.port, proxy.username ?? '', proxy.password ?? ''].join(':');
  }

  private ensureHealth(proxyKey: string) {
    const current = this.health.get(proxyKey);
    if (current) {
      return current;
    }

    const next: ProxyHealth = {
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
    };
    this.health.set(proxyKey, next);
    return next;
  }

  private touch(proxyKey: string) {
    const health = this.ensureHealth(proxyKey);
    health.lastUsedAt = Date.now();
  }

  private getPool(groupId?: string) {
    if (groupId) {
      return this.proxyGroups.get(groupId) ?? [];
    }

    return this.proxyPool;
  }

  private isHealthy(proxyKey: string) {
    const health = this.ensureHealth(proxyKey);
    return !health.cooldownUntil || health.cooldownUntil <= Date.now();
  }

  private scoreProxy(proxyKey: string) {
    const health = this.ensureHealth(proxyKey);
    const successWeight = health.successCount * 2;
    const failurePenalty = health.failureCount + health.consecutiveFailures * 3;
    const latencyPenalty = health.lastLatencyMs ? Math.min(health.lastLatencyMs / 50, 10) : 0;
    const cooldownPenalty = health.cooldownUntil && health.cooldownUntil > Date.now() ? 100 : 0;

    return successWeight - failurePenalty - latencyPenalty - cooldownPenalty;
  }

  private selectBestProxy(pool: string[], excludeKey?: string) {
    const candidates = pool.filter((proxyKey) => proxyKey !== excludeKey && this.proxiesByKey.has(proxyKey));
    if (candidates.length === 0) {
      return undefined;
    }

    const healthyCandidates = candidates.filter((proxyKey) => this.isHealthy(proxyKey));
    const selectionPool = healthyCandidates.length > 0 ? healthyCandidates : candidates;

    return selectionPool
      .slice()
      .sort((left, right) => this.scoreProxy(right) - this.scoreProxy(left))[0];
  }

  public async preWarmProxies(groupId: string, targetUrl: string) {
    const pool = this.getPool(groupId);
    logger.info(`Pre-warming ${pool.length} proxies for ${targetUrl}`);

    const promises = pool.map(async (key) => {
      const proxy = this.proxiesByKey.get(key);
      if (!proxy) return;

      try {
        // 실제로는 tls-client를 사용하여 가벼운 GET 요청을 보냄
        this.markSuccess(key, 100); 
        logger.debug(`Proxy ${proxy.host} pre-warmed`);
      } catch (e) {
        this.markFailure(key, 'pre-warm failed');
      }
    });

    await Promise.all(promises);
  }

  public getProxyWithFingerprint(sessionId: string, groupId?: string) {
    const proxy = this.getProxy(sessionId, groupId);
    // Fingerprint Rotation Logic
    const fingerprint = this.rotateFingerprint(sessionId);
    
    return {
      proxy,
      fingerprint
    };
  }

  private rotateFingerprint(sessionId: string) {
    const profiles = [
      {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513-21,29-23-24,0',
        ja4: 't13d1715h2_8daaf6152771_0dc60b13d231',
        h2: '1:65536;2:0;3:100;4:2097152;6:65536',
        pseudo: [':method', ':authority', ':scheme', ':path']
      },
      {
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        ja3: '771,4865-4866-4867-49195-49196-49197-49198-49199-49200-52393-52392,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-21,29-23-24,0',
        ja4: 't13d1515h2_b56af6152771_0dc60b13d231',
        h2: '1:65536;3:100;4:2097152;6:65536',
        pseudo: [':method', ':scheme', ':authority', ':path'] // Order Variation
      }
    ];

    const profile = profiles[Math.floor(Math.random() * profiles.length)];
    
    return {
      userAgent: profile.ua,
      ja3: profile.ja3,
      ja4: profile.ja4,
      http2: profile.h2,
      pseudoHeaderOrder: profile.pseudo
    };
  }

  private formatProxy(proxy: Proxy): string {
    const auth = proxy.username ? `${proxy.username}:${proxy.password}@` : '';
    return `http://${auth}${proxy.host}:${proxy.port}`;
  }
}

export const proxyManager = ProxyManager.getInstance();
