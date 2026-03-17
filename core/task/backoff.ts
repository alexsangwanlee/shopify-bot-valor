export function calculateBackoff(
  retryCount: number,
  baseMs: number = 1_000,
  jitter: number = 0.4,
): number {
  const exponent = Math.min(retryCount, 6);
  const backoff = baseMs * Math.pow(2, exponent);
  const randomJitter = Math.random() * backoff * jitter;

  return backoff + randomJitter;
}

export function isRetryableError(error: string): boolean {
  const lowercaseError = error.toLowerCase();

  const nonRetryable = [
    'payment declined',
    'card declined',
    'invalid address',
    'banned',
    'proxy authentication failed',
    'out of stock',
    'sold out',
  ];

  if (nonRetryable.some((message) => lowercaseError.includes(message))) {
    return false;
  }

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
    'unexpected exit',
  ];

  return retryable.some((message) => lowercaseError.includes(message));
}
