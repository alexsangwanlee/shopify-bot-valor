/**
 * @file core/proxy/manager.ts
 * @description 엘리트급 프록시 관리 모듈 (Sticky Session, Failover, Pool Rotation)
 */

import { logger } from '../../utils/logger';

export interface Proxy {
  host: string;
  port: number;
  username?: string;
  password?: string;
  type: 'residential' | 'datacenter' | 'mobile';
}

export class ProxyManager {
  private static instance: ProxyManager;
  private proxyPool: Proxy[] = [];
  private stickySessions: Map<string, Proxy> = new Map();

  private constructor() {}

  public static getInstance(): ProxyManager {
    if (!ProxyManager.instance) {
      ProxyManager.instance = new ProxyManager();
    }
    return ProxyManager.instance;
  }

  /**
   * 프록시 풀 업데이트
   */
  public setPool(proxies: Proxy[]) {
    this.proxyPool = proxies;
    logger.info(`ProxyManager: Pool updated with ${proxies.length} proxies.`);
  }

  /**
   * 특정 세션(taskId 등)에 대한 프록시 획득
   * @param sessionId 고유 세션 ID (Sticky Session 용)
   * @param forceNew 새로운 프록시 강제 할당 (Failover 시 사용)
   */
  public getProxy(sessionId: string, forceNew: boolean = false): string | undefined {
    if (!forceNew && this.stickySessions.has(sessionId)) {
      const sessionProxy = this.stickySessions.get(sessionId)!;
      return this.formatProxy(sessionProxy);
    }

    if (this.proxyPool.length === 0) return undefined;

    // 랜덤 선택 (Round-robin이나 Load-balancing으로 확장 가능)
    const newProxy = this.proxyPool[Math.floor(Math.random() * this.proxyPool.length)];
    this.stickySessions.set(sessionId, newProxy);
    
    return this.formatProxy(newProxy);
  }

  /**
   * 프록시 문자열 포맷팅
   */
  private formatProxy(proxy: Proxy): string {
    const auth = proxy.username ? `${proxy.username}:${proxy.password}@` : '';
    return `http://${auth}${proxy.host}:${proxy.port}`;
  }

  /**
   * 세션 종료 시 정리
   */
  public releaseSession(sessionId: string) {
    this.stickySessions.delete(sessionId);
  }

  /**
   * Failover 로직: 현재 프록시가 작동하지 않을 때 교체
   */
  public failover(sessionId: string): string | undefined {
    logger.warn(`ProxyManager: Failover triggered for session [${sessionId}]`);
    return this.getProxy(sessionId, true);
  }
}

export const proxyManager = ProxyManager.getInstance();
