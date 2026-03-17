import { SupremeTask } from './task/types';

export interface BillingCardPayload {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardHolder: string;
}

export interface BillingProfile {
  id: string;
  name: string;
  email: string;
  address1: string;
  city: string;
  phone?: string;
  province?: string;
  zip?: string;
  country?: string;
  captchaApiKey?: string;
  cardBrand: string;
  last4: string;
  cardHolder?: string;
  expiryMonth?: string;
  expiryYear?: string;
  hasSecureCard?: boolean;
  validated: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface BillingProfileInput {
  id?: string;
  name: string;
  email: string;
  address1: string;
  city: string;
  phone?: string;
  province?: string;
  zip?: string;
  country?: string;
  captchaApiKey?: string;
  cardBrand?: string;
  last4?: string;
  cardHolder?: string;
  expiryMonth?: string;
  expiryYear?: string;
  hasSecureCard?: boolean;
  secureCard?: BillingCardPayload | null;
  validated?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface StoredBillingProfile extends BillingProfile {
  secureCardPayload?: string;
}

export interface ResolvedBillingProfile extends BillingProfile {
  secureCard?: BillingCardPayload;
}

export type ProxyEntryStatus = 'unchecked' | 'valid' | 'invalid';

export interface ProxyEntry {
  id: string;
  raw: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  status: ProxyEntryStatus;
  latencyMs?: number;
  error?: string;
  lastCheckedAt?: number;
}

export interface ProxyGroup {
  id: string;
  name: string;
  entries: ProxyEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface StoredAppConfig {
  webhookUrl: string;
  maxConcurrent: number;
  autoSaveInterval: number;
  notificationsEnabled: boolean;
  processingRecheckIntervalSec: number;
  processingMaxChecks: number;
  monitorDefaultPollIntervalSec: number;
  proxySpeedTestUrl: string;
}

export interface AppBackupPayload {
  version: 1;
  exportedAt: number;
  config: StoredAppConfig;
  tasks: SupremeTask[];
  profiles: BillingProfile[];
  proxies: ProxyGroup[];
}

export function isProfileValidated(
  profile: Pick<BillingProfile, 'email' | 'address1' | 'city' | 'last4'>,
) {
  return (
    profile.email.includes('@') &&
    profile.address1.trim().length > 3 &&
    profile.city.trim().length > 1 &&
    /^\d{4}$/.test(profile.last4)
  );
}

export function parseProxyLine(line: string) {
  const raw = line.trim();
  const parts = raw.split(':');

  if (parts.length !== 2 && parts.length !== 4) {
    throw new Error('Expected host:port or host:port:user:pass');
  }

  const [host, portValue, username, password] = parts;
  const port = Number(portValue);

  if (!host) {
    throw new Error('Host is required');
  }

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('Port must be between 1 and 65535');
  }

  return {
    raw,
    host,
    port,
    username,
    password,
  };
}
