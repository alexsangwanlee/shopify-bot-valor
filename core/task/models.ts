/**
 * @file core/task/models.ts
 * @description 태스크 데이터 및 상태 관리를 위한 Zod 스키마 정의
 */

import { z } from 'zod';

// 태스크 우선순위 정의
export const TaskPriority = z.enum(['high', 'normal', 'low']);
export type TaskPriorityType = z.infer<typeof TaskPriority>;

// 태스크 상태 정의
export const TaskStatus = z.enum([
  'idle', 
  'queued', 
  'running', 
  'success', 
  'failed', 
  'captcha', 
  'retrying', 
  'banned', 
  'stopped'
]);
export type TaskStatusType = z.infer<typeof TaskStatus>;

// 태스크 데이터 모델 스키마
export const TaskSchema = z.object({
  id: z.string().uuid().or(z.string()),
  storeUrl: z.string().url(),
  productUrl: z.string().url().optional(),
  keywords: z.array(z.string()).optional(),
  variantId: z.string().optional(),
  profileId: z.string(),
  proxyGroupId: z.string().optional(),
  priority: TaskPriority.default('normal'),
  retryConfig: z.object({
    maxRetries: z.number().min(0).default(5),
    delayMs: z.number().min(0).default(3000),
    useJitter: z.boolean().default(true),
  }).default({}),
});

export type TaskData = z.infer<typeof TaskSchema>;

// 태스크 런타임 상태 스키마
export const TaskStateSchema = z.object({
  id: z.string(),
  status: TaskStatus,
  message: z.string(),
  retryCount: z.number().default(0),
  lastUpdate: z.number().default(() => Date.now()),
});

export type TaskState = z.infer<typeof TaskStateSchema>;
