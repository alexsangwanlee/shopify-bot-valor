/**
 * @file core/task/schemas.ts
 * @description Zod를 통한 Supreme 태스크 런타임 검증 및 팩토리 로직
 */

import { z } from 'zod';
import { 
  SupremeTask, 
  TaskId, 
  ProfileId, 
  ProxyGroupId, 
} from './types';

/**
 * 헬퍼: Branded Type 캐스팅
 */
const asTaskId = (val: string) => val as TaskId;
const asProfileId = (val: string) => val as ProfileId;
const asProxyGroupId = (val: string) => val as ProxyGroupId;

/**
 * Supreme 태스크 Zod 스키마 정의 (Strict Mode & Cross-field Validation)
 */
export const supremeTaskSchema = z.object({
  // UUID 자동 생성 및 TaskId 브랜딩
  id: z.string().default(() => require('crypto').randomUUID()).transform(asTaskId),
  createdAt: z.number().default(() => Date.now()),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  status: z.enum(['waiting', 'running', 'paused', 'success', 'failed', 'cancelled', 'monitoring']).default('waiting'),
  
  profileId: z.string().transform(asProfileId),
  proxyGroup: z.string().optional().transform((v) => v ? asProxyGroupId(v) : undefined),
  quantity: z.number().min(1).default(1),
  size: z.union([z.string(), z.string().array()]).optional(),
  color: z.string().optional(),
  
  mode: z.enum(['fast', 'safe', 'monitor']),
  url: z.string().url().optional(),
  keywords: z.string().array().optional(),
  
  maxRetries: z.number().min(0).default(5),
  retryDelayMs: z.number().min(0).default(3000),
  
  logs: z.string().array().max(80).default([]),
  lastError: z.string().optional(),
  
  result: z.object({
    orderNumber: z.string().optional(),
    total: z.number().optional(),
  }).optional(),
}).superRefine((val, ctx) => {
  // Discriminated Union 논리 검증: 모드에 따른 필수 필드 체크
  if (val.mode === 'monitor' && (!val.keywords || val.keywords.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Monitor mode requires at least one keyword",
      path: ['keywords']
    });
  }
  
  if ((val.mode === 'fast' || val.mode === 'safe') && !val.url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "ATC mode (fast/safe) requires a valid Supreme product URL",
      path: ['url']
    });
  }
  
  // URL과 Keywords 상호 배타성 검증 (타입 레벨에서는 never로 처리됨)
  if (val.mode === 'monitor' && val.url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Monitor mode cannot have a URL",
      path: ['url']
    });
  }
});

/**
 * 타입 세이프 팩토리 함수
 */
export function createSupremeTask(input: z.input<typeof supremeTaskSchema>): SupremeTask {
  return supremeTaskSchema.parse(input) as SupremeTask;
}

/**
 * 타입 가드 함수
 */
export function isValidSupremeTask(task: unknown): task is SupremeTask {
  const result = supremeTaskSchema.safeParse(task);
  return result.success;
}

/**
 * 기본값 기반 빈 태스크 팩토리
 */
export function createEmptyTask(mode: 'fast' | 'safe' | 'monitor'): SupremeTask {
  return createSupremeTask({
    mode,
    profileId: 'default' as ProfileId,
    // 모드에 따라 최소 필수값만 채움
    url: mode !== 'monitor' ? 'https://www.supremenewyork.com/shop/all' : undefined,
    keywords: mode === 'monitor' ? ['supreme'] : undefined,
  });
}
