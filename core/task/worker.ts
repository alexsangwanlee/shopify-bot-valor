/**
 * @file core/task/worker.ts
 * @description Supreme 전용 워커 스레드 (Piscina 기반 비즈니스 로직 실행부)
 */

import { parentPort } from 'worker_threads';
import { SupremeTask, TaskId } from './types';
import { proxyManager } from '../proxy/manager';

/**
 * 전역 변수 및 헬퍼
 */
let currentTaskId: TaskId;

function sendToMain(type: 'log' | 'status' | 'success' | 'error', payload: any) {
  parentPort?.postMessage({
    type,
    taskId: currentTaskId,
    payload,
    timestamp: Date.now(),
  });
}

function log(message: string) {
  sendToMain('log', message);
}

function updateStatus(status: string) {
  sendToMain('status', status);
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Piscina 워커 진입점
 */
export default async (data: { taskId: TaskId; task: SupremeTask }) => {
  const { taskId, task } = data;
  currentTaskId = taskId;

  try {
    // 0. 프록시 설정 (Sticky Session)
    let proxy = proxyManager.getProxy(taskId);
    log(`Using proxy session: ${proxy ? 'REDACTED' : 'DIRECT'}`);

    log(`[${task.mode.toUpperCase()}] Starting sequence for ${task.url || task.keywords?.join(', ')}`);
    
    // 1. 모니터링/대기 단계 (Elite Monitoring: GraphQL / WebSocket Placeholder)
    updateStatus('monitoring');
    log('Scanning inventory (GraphQL/WebSocket fallback enabled)...');
    await sleep(2000 + Math.random() * 3000);

    // 2. 상품 세부 정보 로드 및 옵션 선택
    log(`Product detected! Processing metadata...`);
    await sleep(400);

    // Captcha Check Placeholder
    log('Checking for Captcha requirements...');
    if (Math.random() > 0.7) {
      log('Captcha detected! Solving via Capsolver (Fallback: 2Captcha)...');
      await sleep(2000); // Solver delay
      log('Captcha solved successfully.');
    }

    const selectedSize = Array.isArray(task.size) ? task.size[0] : (task.size || 'Large');
    log(`Selected options: Size [${selectedSize}] / Color [${task.color || 'Default'}]`);

    // 3. ATC (Add to Cart) 단계
    updateStatus('running');
    log('Attempting ATC [POST /cart/add.js]...');
    
    // HTTP/2 Pseudo-header Randomization Simulation
    log('Randomizing H2 pseudo-headers for Akamai bypass...');
    await sleep(600 + Math.random() * 400);
    
    // 4. 세션 초기화 및 패킹
    log('Cart persistence confirmed. Initializing headless checkout session...');
    await sleep(1200);

    // 5. 배송 정보 제출 (Shipping)
    log('Submitting encrypted browser fingerprints & shipping manifest...');
    await sleep(800);

    // 6. 결제 및 큐 대기 (Payment / Queue)
    log('Bypassing Shopify Queue... Submitting payment payload.');
    updateStatus('running');
    await sleep(2000 + Math.random() * 1000);

    // 랜덤 성공/실패 시뮬레이션 (80% 성공)
    if (Math.random() > 0.2) {
      const mockOrder = `SUP-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      sendToMain('success', { 
        orderNumber: mockOrder,
        total: 158.00 
      });
      log(`ORDER CONFIRMED: ${mockOrder}`);
      return { success: true, orderNumber: mockOrder };
    } else {
      // 프록시 Failover 테스트
      proxy = proxyManager.failover(taskId);
      throw new Error("Payment declined: High-risk session detected. Rotating proxy & retrying...");
    }

  } catch (error: any) {
    log(`FATAL: ${error.message}`);
    sendToMain('error', {
      message: error.message,
      stack: error.stack
    });
    throw error; // Piscina will catch this
  } finally {
    proxyManager.releaseSession(taskId);
  }
};

// 런타임 에러 전역 캐치
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection in Worker:', reason);
});
