/**
 * @file utils/logger.ts
 * @description 애플리케이션 로그 기록 시스템 (Winston 기반)
 */

import winston from 'winston';
import path from 'path';

const { combine, timestamp, json, printf, colorize } = winston.format;

// 커스텀 로그 포맷 정의 (콘솔 출력용)
const customFormat = printf(({ level, message, timestamp, taskId, ...metadata }) => {
  let msg = `${timestamp} [${level}]${taskId ? ` [Task:${taskId}]` : ''} : ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

export const createLogger = (taskId?: string) => {
  const logDir = path.join(process.cwd(), 'logs');
  const filename = taskId ? `task-${taskId}.log` : 'combined.log';

  return winston.createLogger({
    level: 'info',
    format: combine(
      timestamp(),
      json()
    ),
    transports: [
      // 콘솔 출력
      new winston.transports.Console({
        format: combine(
          colorize(),
          timestamp({ format: 'HH:mm:ss' }),
          customFormat
        )
      }),
      // 파일 저장 (JSON)
      new winston.transports.File({ 
        filename: path.join(logDir, filename),
        format: json()
      })
    ]
  });
};

// 기본 전역 로거
export const logger = createLogger();
