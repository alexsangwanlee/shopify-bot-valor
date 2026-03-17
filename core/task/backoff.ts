/**
 * @file core/task/backoff.ts
 * @description Supreme 전용 지수 백오프 및 재시도 판단 로직
 */

/**
 * 지수 백오프 계산 (Exponential Backoff with Jitter)
 */
export function calculateBackoff(retryCount: number, baseMs: number = 1000, jitter: number = 0.4): number {
  const exponent = Math.min(retryCount, 6); // 최대 2^6배까지만 증가
  const backoff = baseMs * Math.pow(2, exponent);
  const randomJitter = Math.random() * backoff * jitter;
  
  return backoff + randomJitter;
}

/**
 * 재시도 가능한 에러인지 확인
 */
export function isRetryableError(error: string): boolean {
  const lowercaseError = error.toLowerCase();
  
  // 재시도 불가능한 에러 (블랙리스트)
  const nonRetryable = [
    'payment declined',
    'card declined',
    'invalid address',
    'banned',
    'proxy authentication failed',
    'out of stock',
    'sold out'
  ];
  
  if (nonRetryable.some(msg => lowercaseError.includes(msg))) {
    return false;
  }
  
  // 재시도 대상 에러 (화이트리스트 성격)
  const retryable = [
    '429',
    'timeout',
    'network',
    '500',
    '502',
    '503',
    '504',
    'session expired',
    'atc failed',
    'unexpected exit'
  ];
  
  return retryable.some(msg => lowercaseError.includes(msg)) || true; // 기본적으로 재시도 허용
}
