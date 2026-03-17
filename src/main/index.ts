/**
 * @file src/main/index.ts
 * @description Electron 메인 프로세스 설정 (프레임리스 윈도우 및 IPC 핸들러)
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { taskQueue } from '../../core/task/queue';
import { storage } from '../../core/configManager';
import { logger } from '../../utils/logger';
import { createSupremeTask } from '../../core/task/schemas';
import { setupAutoUpdater } from './updater';
import { sendDiscordWebhook } from '../../core/utils/notification';

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 700,
    minWidth: 1024,
    minHeight: 700,
    maxWidth: 1024,
    maxHeight: 700,
    resizable: false,
    frame: false, // 프레임리스 설정
    backgroundColor: '#0a0a0b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // win.webContents.openDevTools(); // 디버깅 시 활성화
}

app.whenReady().then(() => {
  createWindow();

  // TaskQueue 이벤트 리스너 등록 후 렌더러로 전송
  const win = BrowserWindow.getAllWindows()[0];
  
  taskQueue.on('task:status', (payload) => {
    win?.webContents.send('task:status-changed', payload);
  });

  taskQueue.on('task:log', (payload) => {
    win?.webContents.send('task:log-append', payload);
  });

  if (process.env.NODE_ENV !== 'development') {
    setupAutoUpdater();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  logger.info('Main: Preparing to quit, saving tasks...');
  taskQueue.cleanupAll();
  await storage.savePayload('tasks.json', taskQueue.getAllTasks());
});

// Supreme Task IPC 핸들러
ipcMain.handle('tasks:get-all', () => {
  return taskQueue.getAllTasks();
});

ipcMain.handle('tasks:get-stats', () => {
  return taskQueue.getStats();
});

ipcMain.handle('tasks:operate', async (_event, { action, ids }) => {
  try {
    ids.forEach((id: any) => {
      switch (action) {
        case 'start': taskQueue.retryTask(id); break;
        case 'pause': taskQueue.pauseTask(id); break;
        case 'cancel': taskQueue.cancelTask(id); break;
        case 'retry': taskQueue.retryTask(id); break;
      }
    });
    return { success: true };
  } catch (error: any) {
    logger.error(`IPC: tasks:operate failed`, { error: error.message });
    throw error;
  }
});

ipcMain.handle('tasks:add', async (_event, input) => {
  try {
    const task = createSupremeTask(input);
    taskQueue.addTask(task);
    return { success: true };
  } catch (error: any) {
    logger.error(`IPC: tasks:add failed`, { error: error.message });
    throw error;
  }
});

ipcMain.handle('tasks:update', async (_event, { id, updates }) => {
  try {
    taskQueue.updateTask(id, updates);
    return { success: true };
  } catch (error: any) {
    logger.error(`IPC: tasks:update failed`, { error: error.message });
    throw error;
  }
});

ipcMain.handle('profiles:get-all', async () => {
  return storage.loadPayload('profiles.json', []);
});

ipcMain.handle('config:get', async () => {
  return storage.loadConfig();
});

ipcMain.handle('config:save', async (_event, config) => {
  await storage.saveConfig(config);
});

ipcMain.handle('webhook:test', async (_event, url) => {
  await sendDiscordWebhook(url, {
    embeds: [{
      title: '🔔 Hook Test: Valor Engine',
      description: 'Your Discord webhook is correctly configured and synchronized with the bot engine.',
      color: 0x00ffd0,
      timestamp: new Date().toISOString()
    }]
  });
});

// 창 닫기/최소화 핸들러
ipcMain.on('window-controls', (_event, action: 'minimize' | 'close') => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  if (action === 'minimize') win.minimize();
  if (action === 'close') win.close();
});
