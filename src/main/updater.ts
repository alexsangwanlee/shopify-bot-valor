/**
 * @file src/main/updater.ts
 * @description electron-updater를 사용한 자동 업데이트 로직
 */

import { autoUpdater } from 'electron-updater';
import { logger } from '../../utils/logger';

export const setupAutoUpdater = () => {
  autoUpdater.logger = logger;

  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    logger.info('Update available:', info.version);
    // TODO: 렌더러에 업데이트 알림 전송 (ipcMain.send)
  });

  autoUpdater.on('update-not-available', (info) => {
    logger.info('Update not available.');
  });

  autoUpdater.on('error', (err) => {
    logger.error('Error in auto-updater:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    logger.info(log_message);
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info('Update downloaded; will install in 5 seconds');
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 5000);
  });

  // 앱 시작 시 업데이트 확인
  autoUpdater.checkForUpdatesAndNotify();
};
