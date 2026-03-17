// @ts-ignore - node-tls-client might not have types
const { Client } = require('node-tls-client');
import { logger } from './logger';

export interface Fingerprint {
  ja3: string;
  http2: string;
}

export interface ClientOptions {
  fingerprint: Fingerprint;
  proxy?: string;
  timeout?: number;
}

export function createHttpClient(options: ClientOptions) {
  const { fingerprint, proxy, timeout = 30000 } = options;

  // 헤더 순서 랜덤화 (Akamai Bot Manager 우회용)
  const headerOrder = shuffle([
    'host', 'connection', 'cache-control', 'device-memory', 'viewport-width',
    'rtt', 'downlink', 'ect', 'sec-ch-ua', 'sec-ch-ua-mobile',
    'sec-ch-ua-platform', 'upgrade-insecure-requests', 'user-agent',
    'accept', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-user',
    'sec-fetch-dest', 'accept-encoding', 'accept-language'
  ]);

  // HTTP/2 Pseudo-header 순서 랜덤화
  const pseudoHeaderOrder = shuffle([':method', ':authority', ':scheme', ':path']);

  try {
    return new Client({
      ja3: fingerprint.ja3,
      http2Settings: fingerprint.http2,
      proxy,
      timeout,
      headerOrder,
      pseudoHeaderOrder,
    });
  } catch (error) {
    logger.error('Failed to create HTTP client', { error, fingerprint, proxy });
    throw error;
  }
}

function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}
