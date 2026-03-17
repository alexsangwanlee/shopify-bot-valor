// @ts-ignore - node-tls-client might not have types
const { Session, initTLS, destroyTLS } = require('node-tls-client');
import { logger } from './logger';

export async function initializeTLS() {
  try {
    await initTLS();
    logger.info('TLS Client initialized');
  } catch (error) {
    logger.error('Failed to initialize TLS', { error });
    throw error; // Make it fatal
  }
}

export async function terminateTLS() {
  try {
    await destroyTLS();
    logger.info('TLS Client terminated');
  } catch (error) {
    logger.error('Failed to terminate TLS', { error });
  }
}

export interface Fingerprint {
  ja3?: string;
  ja4?: string;
  http2?: string;
  h2SettingsOrder?: string[];
  userAgent: string;
}

export interface ClientOptions {
  fingerprint: Fingerprint;
  proxy?: string;
  timeout?: number;
  headerOrder?: string[];
  pseudoHeaderOrder?: string[];
}

export function createHttpClient(options: ClientOptions) {
  const { fingerprint, proxy, timeout = 30000 } = options;

  try {
    const session = new Session({
      ja3string: fingerprint.ja3,
      h2Settings: fingerprint.http2 ? parseH2Settings(fingerprint.http2) : undefined,
      h2SettingsOrder: fingerprint.h2SettingsOrder,
      proxy,
      timeout,
      headers: {
        'User-Agent': fingerprint.userAgent,
      },
      headerOrder: options.headerOrder,
      followRedirects: true,
      pseudoHeaderOrder: options.pseudoHeaderOrder as any
    });
    
    return session;
  } catch (error) {
    logger.error('Failed to create HTTP session', { error, fingerprint, proxy });
    throw error;
  }
}

function parseH2Settings(h2String: string): any {
  const settings: any = {};
  const parts = h2String.split(';');
  for (const part of parts) {
    const [key, value] = part.split(':');
    if (key === '1') settings.HEADER_TABLE_SIZE = parseInt(value);
    if (key === '2') settings.ENABLE_PUSH = value === '1';
    if (key === '3') settings.MAX_CONCURRENT_STREAMS = parseInt(value);
    if (key === '4') settings.INITIAL_WINDOW_SIZE = parseInt(value);
    if (key === '6') settings.MAX_HEADER_LIST_SIZE = parseInt(value);
  }
  return settings;
}

/**
 * Akamai / PerimeterX Sensor Data Generator
 * realistic-mock generation using telemetry patterns
 */
export class SensorGenerator {
  static generateAkamaiSensor(url: string): string {
    const timestamp = Date.now();
    const parsed = new URL(url);
    const seed = this.seed(`${parsed.hostname}:${parsed.pathname}:${timestamp}`);
    const width = 1920 + (seed % 24);
    const height = 1080 + (seed % 16);
    const timezoneOffset = new Date().getTimezoneOffset();
    const language = 'en-US';
    const platform = 'Win32';
    const hardwareConcurrency = 8 + (seed % 4);
    const deviceMemory = 8;
    const telemetry = {
      version: '2.3.1',
      ts: timestamp,
      origin: parsed.origin,
      path: parsed.pathname,
      viewport: `${width}x${height}`,
      screen: `${width}x${height}x24`,
      lang: language,
      platform,
      tz: timezoneOffset,
      hc: hardwareConcurrency,
      mem: deviceMemory,
      plugins: 5 + (seed % 3),
      touch: 0,
      entropy: this.noise(64, seed),
      motion: this.buildMotionSample(seed),
      nav: this.buildNavigationSample(seed),
    };

    return Buffer.from(JSON.stringify(telemetry)).toString('base64');
  }

  static generatePXSensor(url: string): string {
    const prefix = "px-telemetry-";
    const data = {
      ts: Date.now(),
      uri: url,
      res: "1920x1080",
      noise: this.noise(64)
    };
    return `${prefix}${Buffer.from(JSON.stringify(data)).toString('base64')}`;
  }

  private static noise(length: number, seed: number = Date.now()): string {
    let result = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let current = seed;
    for (let i = 0; i < length; i++) {
      current = (current * 1664525 + 1013904223) % 4294967296;
      result += chars.charAt(current % chars.length);
    }
    return result;
  }

  private static seed(input: string) {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
      hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
    }
    return hash;
  }

  private static buildMotionSample(seed: number) {
    const events = [];
    for (let index = 0; index < 6; index += 1) {
      events.push({
        x: 320 + ((seed + index * 17) % 900),
        y: 180 + ((seed + index * 31) % 420),
        t: 8 + index * 13,
      });
    }
    return events;
  }

  private static buildNavigationSample(seed: number) {
    return {
      depth: 1 + (seed % 4),
      rtt: 50 + (seed % 70),
      downlink: 8 + (seed % 4),
      cores: 8,
    };
  }
}
