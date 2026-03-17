/**
 * @file core/task/retry.ts
 * @description 지터(Jitter)가 포함된 재시도 로직 구현
 */

import { TaskData } from './models';

export function calculateRetryDelay(data: TaskData, currentRetry: number): number {
  const { delayMs, useJitter } = data.retryConfig;
  
  if (!useJitter) return delayMs;

  // Exponential backoff와 비슷한 지터 적용 (단순화된 버전)
  const jitterBase = delayMs * 0.5;
  const jitterFactor = Math.random() * delayMs;
  
  // 기본 지연 시간에 무작위성을 부여하여 서버 부하 분산
  return jitterBase + jitterFactor;
}

export function shouldRetry(data: TaskData, currentRetry: number, error: any): boolean {
  if (currentRetry >= data.retryConfig.maxRetries) return false;

  // 재시도해야 하는 특정 에러 코드 정의 (예: 429, 503, 500 등)
  const retryableStatuses = [429, 500, 502, 503, 504];
  
  if (error && error.status && retryableStatuses.includes(error.status)) {
    return true;
  }

  // 네트워크 타임아웃 등도 재시도 대상
  if (error && (error.code === 'ECONNABORTED' || error.message?.includes('timeout'))) {
    return true;
  }

  return true; // 기본적으로 대부분의 에러에 대해 재시도 시도 테스팅용
}
