import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  SupremeTask,
  TaskId,
  ProfileId,
  ProxyGroupId,
} from './types';

const asTaskId = (value: string) => value as TaskId;
const asProfileId = (value: string) => value as ProfileId;
const asProxyGroupId = (value: string) => value as ProxyGroupId;

export const supremeTaskSchema = z
  .object({
    id: z.string().default(() => randomUUID()).transform(asTaskId),
    createdAt: z.number().default(() => Date.now()),
    queuedAt: z.number().optional(),
    startedAt: z.number().optional(),
    waitDurationMs: z.number().min(0).optional(),
    priority: z.enum(['high', 'normal', 'low']).default('normal'),
    status: z
      .enum(['waiting', 'running', 'paused', 'success', 'failed', 'cancelled', 'monitoring', 'processing'])
      .default('waiting'),
    profileId: z.string().transform(asProfileId),
    proxyGroup: z
      .string()
      .optional()
      .transform((value) => (value ? asProxyGroupId(value) : undefined)),
    quantity: z.number().min(1).default(1),
    size: z.string().optional(),
    sizePreference: z.array(z.string()).optional(),
    color: z.string().optional(),
    styleCode: z.string().optional(),
    paymentMethod: z.enum(['card', 'paypal']).default('card'),
    checkoutMode: z.enum(['auto', 'assist', 'browser']).default('auto'),
    creditCard: z.object({
      cardNumber: z.string().min(13).max(19),
      expiryMonth: z.string().length(2),
      expiryYear: z.string().length(4).or(z.string().length(2)),
      cvv: z.string().min(3).max(4),
      cardHolder: z.string().min(1),
    }).optional(),
    pollIntervalMs: z.number().min(1000).default(3_000),
    mode: z.enum(['fast', 'safe', 'monitor']),
    url: z.string().url(), // Product URL for ATC, Store URL for Monitor
    monitorCategory: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    maxRetries: z.number().min(0).default(5),
    retryCount: z.number().min(0).default(0),
    retryDelayMs: z.number().min(0).default(3_000),
    logs: z.array(z.string()).max(80).default([]),
    lastError: z.string().optional(),
    result: z
      .object({
        orderNumber: z.string().optional(),
        total: z.number().optional(),
        lastStage: z.string().optional(),
        monitorHits: z.number().optional(),
        lastHeartbeatAt: z.number().optional(),
        variantId: z.string().optional(),
        matchedTitle: z.string().optional(),
        matchedHandle: z.string().optional(),
        matchedUrl: z.string().url().optional(),
        matchedCategory: z.string().optional(),
        matchScore: z.number().optional(),
        checkoutUrl: z.string().url().optional(),
        processingChecks: z.number().min(0).optional(),
        verificationUrl: z.string().url().optional(),
      })
      .optional(),
  })
  .superRefine((value, context) => {
    // Mode-specific URL and Keyword validation
    if (value.mode === 'monitor') {
      if (!value.url || !value.url.startsWith('http')) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Monitor mode requires a valid store root URL',
          path: ['url'],
        });
      }
      if (!value.keywords || value.keywords.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Monitor mode requires at least one keyword',
          path: ['keywords'],
        });
      }
    } else {
      // fast/safe modes
      if (!value.url || !value.url.includes('/products/') && !value.url.includes('/variants/')) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Fast/Safe mode requires a valid product or variant URL',
          path: ['url'],
        });
      }
    }
  });

export function createSupremeTask(input: z.input<typeof supremeTaskSchema>): SupremeTask {
  return supremeTaskSchema.parse(input) as SupremeTask;
}

export function isValidSupremeTask(task: unknown): task is SupremeTask {
  return supremeTaskSchema.safeParse(task).success;
}

export function createEmptyTask(mode: 'fast' | 'safe' | 'monitor'): SupremeTask {
  return createSupremeTask({
    mode,
    profileId: 'default' as ProfileId,
    url: mode === 'monitor' ? '' : 'https://www.supremenewyork.com/shop/all',
    keywords: mode === 'monitor' ? ['box logo'] : [],
    checkoutMode: 'auto',
  } as any);
}
