/**
 * @file core/task/types.ts
 * @description Supreme 전용 엄격한 타입 정의 (TypeScript strict mode 최적화)
 */

/**
 * 브랜디드 타입 (Nominal Typing) - ID 혼용 방지
 */
export type TaskId = string & { __brand: 'TaskId' };
export type ProfileId = string & { __brand: 'ProfileId' };
export type ProxyGroupId = string & { __brand: 'ProxyGroupId' };

/**
 * 리터럴 유니온 타입 (Enum 대신 사용 - 런타임 오버헤드 제거)
 */
export type TaskStatus =
  | 'waiting'
  | 'running'
  | 'paused'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'monitoring'
  | 'processing';

export type TaskPriority = 'high' | 'normal' | 'low';
export type CheckoutMode = 'auto' | 'assist' | 'browser';

/**
 * Discriminated Union 패턴을 통한 모드별 타입 추론 보장
 */
export type MonitorOnlyTask = {
  mode: 'monitor';
  keywords: string[];
  url: string; // Store URL
  monitorCategory?: string;
};

export type AtcTask = {
  mode: 'fast' | 'safe';
  url: string; // Product URL or Variant URL
  keywords?: string[]; 
};

/**
 * 공통 태스크 데이터 정의
 */
export type SupremeTaskBase = {
  id: TaskId;
  createdAt: number;
  queuedAt?: number;
  startedAt?: number;
  waitDurationMs?: number;
  priority: TaskPriority;
  status: TaskStatus;
  profileId: ProfileId;
  proxyGroup?: ProxyGroupId;
  quantity: number;
  size?: string;
  sizePreference?: string[]; // Multiple size candidates
  color?: string;
  styleCode?: string; // Supreme-specific style/item code
  paymentMethod: 'card' | 'paypal'; // Supreme payment options
  checkoutMode: CheckoutMode;
  creditCard?: {
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    cardHolder: string;
  };
  pollIntervalMs: number;
  maxRetries: number;
  retryCount: number;
  retryDelayMs: number;
  logs: string[];
  lastError?: string;
  result?: {
    orderNumber?: string;
    total?: number;
    lastStage?: string;
    monitorHits?: number;
    lastHeartbeatAt?: number;
    variantId?: string; // Added variantId
    matchedTitle?: string;
    matchedHandle?: string;
    matchedUrl?: string;
    matchedCategory?: string;
    matchScore?: number;
    checkoutUrl?: string;
    processingChecks?: number;
    verificationUrl?: string;
  };
};

/**
 * 최종 SupremeTask 타입 (Intersection + Discriminated Union)
 */
export type SupremeTask = SupremeTaskBase & (MonitorOnlyTask | AtcTask);
