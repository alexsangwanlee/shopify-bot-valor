import os from 'os';
import path from 'path';
import Piscina from 'piscina';
import { logger } from '../../utils/logger';

const maxThreads = 50; // Increased for better network concurrency

export const taskPool = new Piscina({
  filename: path.resolve(__dirname, 'worker.js'),
  name: 'runTask',
  minThreads: 1,
  maxThreads,
  idleTimeout: 60_000,
  concurrentTasksPerWorker: 4, // Allow multiple async tasks per thread
});

taskPool.on('error', (error) => {
  logger.error('Piscina pool error', { error: error.message });
});

logger.info(`Piscina task pool initialized with max ${maxThreads} threads.`);
