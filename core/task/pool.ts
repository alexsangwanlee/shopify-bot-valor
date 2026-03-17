/**
 * @file core/task/pool.ts
 * @description Piscina 기반 워커 풀 매니저 (고동시성 태스크 안정성 확보)
 */

import Piscina from 'piscina';
import path from 'path';
import { logger } from '../../utils/logger';

// Piscina 싱글톤 인스턴스
export const taskPool = new Piscina({
  filename: path.resolve(__dirname, 'worker.js'),
  minThreads: 10,
  maxThreads: 500, // 200~500개 태스크 대응
  idleTimeout: 30000, // 30초 유휴 시 스레드 종료
  concurrentTasksPerWorker: 1, // 한 스레드당 한 태스크 (격리성 보장)
});

taskPool.on('error', (err) => {
  logger.error('Piscina Pool Error:', { error: err.message });
});

logger.info('Piscina Task Pool Initialized (max: 500 threads)');
