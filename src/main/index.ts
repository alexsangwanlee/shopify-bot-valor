import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import {
  AppBackupPayload,
  BillingCardPayload,
  BillingProfile,
  BillingProfileInput,
  ProxyEntry,
  ProxyGroup,
  ResolvedBillingProfile,
  StoredBillingProfile,
  isProfileValidated,
  parseProxyLine,
} from '../../core/app-data';
import { DEFAULT_APP_CONFIG, storage, type AppConfig } from '../../core/configManager';
import { proxyManager, type Proxy } from '../../core/proxy/manager';
import { taskQueue } from '../../core/task/queue';
import { createSupremeTask } from '../../core/task/schemas';
import { TaskId } from '../../core/task/types';
import { sendDiscordWebhook } from '../../core/utils/notification';
import { logger } from '../../utils/logger';
import { setupAutoUpdater } from './updater';
import { createHttpClient, initializeTLS, terminateTLS } from '../../utils/tls-client';

const isDevelopment = !app.isPackaged;
const TASK_STATUS_CHANNEL = 'task-status-changed';
const TASK_LOG_CHANNEL = 'task-log-append';
const PROFILES_FILENAME = 'profiles.json';
const PROXIES_FILENAME = 'proxies.json';

let mainWindow: BrowserWindow | null = null;
let autoSaveTimer: NodeJS.Timeout | null = null;

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function escapeCsvValue(value: string | number | boolean) {
  const stringValue = String(value ?? '');
  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
}

function encryptSecureCard(card?: BillingCardPayload | null) {
  if (!card) {
    return undefined;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS secure storage is unavailable on this machine');
  }

  return safeStorage.encryptString(JSON.stringify(card)).toString('base64');
}

function decryptSecureCard(payload?: string): BillingCardPayload | undefined {
  if (!payload) {
    return undefined;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS secure storage is unavailable on this machine');
  }

  return JSON.parse(safeStorage.decryptString(Buffer.from(payload, 'base64'))) as BillingCardPayload;
}

function sanitizeProfile(profile: StoredBillingProfile): BillingProfile {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    address1: profile.address1,
    city: profile.city,
    phone: profile.phone,
    province: profile.province,
    zip: profile.zip,
    country: profile.country,
    captchaApiKey: profile.captchaApiKey,
    cardBrand: profile.cardBrand,
    last4: profile.last4,
    cardHolder: profile.cardHolder,
    expiryMonth: profile.expiryMonth,
    expiryYear: profile.expiryYear,
    hasSecureCard: Boolean(profile.secureCardPayload),
    validated: profile.validated,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function resolveProfile(profile: StoredBillingProfile): ResolvedBillingProfile {
  const secureCard = decryptSecureCard(profile.secureCardPayload);
  return {
    ...sanitizeProfile(profile),
    secureCard,
  };
}

function normalizeProfile(
  profile: BillingProfileInput | StoredBillingProfile,
  previous?: StoredBillingProfile,
): StoredBillingProfile {
  const profileInput = profile as BillingProfileInput;
  const secureCardPayload =
    'secureCardPayload' in profile
      ? profile.secureCardPayload
      : profileInput.secureCard === null
        ? undefined
        : profileInput.secureCard
          ? encryptSecureCard(profileInput.secureCard)
          : previous?.secureCardPayload;
  const resolvedLast4 =
    (profileInput.secureCard?.cardNumber
      ? profileInput.secureCard.cardNumber
      : profile.last4 ?? previous?.last4 ?? '')
      .replace(/\D/g, '')
      .slice(-4);
  const resolvedCardHolder =
    profileInput.secureCard?.cardHolder ||
    profile.cardHolder ||
    previous?.cardHolder ||
    '';
  const resolvedExpiryMonth =
    profileInput.secureCard?.expiryMonth ||
    profile.expiryMonth ||
    previous?.expiryMonth ||
    '';
  const resolvedExpiryYear =
    profileInput.secureCard?.expiryYear ||
    profile.expiryYear ||
    previous?.expiryYear ||
    '';

  const normalized: StoredBillingProfile = {
    ...previous,
    ...profile,
    id: profile.id || previous?.id || randomUUID(),
    name: String(profile.name ?? previous?.name ?? '').trim(),
    email: String(profile.email ?? previous?.email ?? '').trim(),
    address1: String(profile.address1 ?? previous?.address1 ?? '').trim(),
    city: String(profile.city ?? previous?.city ?? '').trim(),
    phone: String(profile.phone ?? previous?.phone ?? '').trim() || undefined,
    province: String(profile.province ?? previous?.province ?? '').trim() || undefined,
    zip: String(profile.zip ?? previous?.zip ?? '').trim() || undefined,
    country: String(profile.country ?? previous?.country ?? '').trim() || 'United States',
    captchaApiKey: String(profile.captchaApiKey ?? previous?.captchaApiKey ?? '').trim() || undefined,
    cardBrand: String(profile.cardBrand ?? previous?.cardBrand ?? '').trim() || 'Card',
    last4: resolvedLast4,
    cardHolder: resolvedCardHolder || undefined,
    expiryMonth: resolvedExpiryMonth || undefined,
    expiryYear: resolvedExpiryYear || undefined,
    secureCardPayload,
    createdAt: profile.createdAt || previous?.createdAt || Date.now(),
    updatedAt: Date.now(),
    hasSecureCard: Boolean(secureCardPayload),
    validated: Boolean(profile.validated ?? previous?.validated),
  };

  normalized.validated = normalized.validated || isProfileValidated(normalized);
  return normalized;
}

function profilesToCsv(profiles: BillingProfile[]) {
  const header = [
    'id',
    'name',
    'email',
    'address1',
    'city',
    'phone',
    'province',
    'zip',
    'country',
    'cardBrand',
    'cardHolder',
    'expiryMonth',
    'expiryYear',
    'last4',
    'validated',
    'hasSecureCard',
  ];
  const rows = profiles.map((profile) =>
    [
      profile.id,
      profile.name,
      profile.email,
      profile.address1,
      profile.city,
      profile.phone ?? '',
      profile.province ?? '',
      profile.zip ?? '',
      profile.country ?? '',
      profile.cardBrand,
      profile.cardHolder ?? '',
      profile.expiryMonth ?? '',
      profile.expiryYear ?? '',
      profile.last4,
      profile.validated,
      Boolean(profile.hasSecureCard),
    ]
      .map(escapeCsvValue)
      .join(','),
  );

  return [header.join(','), ...rows].join('\n');
}

function parseProfilesCsv(csv: string) {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rows.length <= 1) {
    return [];
  }

  const headers = splitCsvLine(rows[0]).map((header) => header.trim().toLowerCase());

  return rows
    .slice(1)
    .map((row) => {
      const values = splitCsvLine(row);
      const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
      const last4 = String(
        record.last4 ?? record.cardlast4 ?? record.card_last4 ?? record.card_last_four ?? '',
      )
        .replace(/\D/g, '')
        .slice(-4);

      const profile: BillingProfileInput = {
        id: record.id || randomUUID(),
        name: (record.name ?? '').trim(),
        email: (record.email ?? '').trim(),
        address1: (record.address1 ?? record.address ?? '').trim(),
        city: (record.city ?? '').trim(),
        phone: (record.phone ?? '').trim() || undefined,
        province: (record.province ?? record.state ?? '').trim() || undefined,
        zip: (record.zip ?? record.zipcode ?? record.postalcode ?? '').trim() || undefined,
        country: (record.country ?? '').trim() || undefined,
        cardBrand: (record.cardbrand ?? record.brand ?? 'Card').trim(),
        cardHolder: (record.cardholder ?? record.nameoncard ?? '').trim() || undefined,
        expiryMonth: (record.expirymonth ?? record.exp_month ?? '').trim() || undefined,
        expiryYear: (record.expiryyear ?? record.exp_year ?? '').trim() || undefined,
        last4,
        validated:
          String(record.validated ?? '')
            .trim()
            .toLowerCase() === 'true',
      };

      return normalizeProfile(profile);
    })
    .filter((profile) => profile.name.length > 0 || profile.email.length > 0);
}

function toPoolProxy(entry: ProxyEntry): Proxy | null {
  if (entry.status !== 'valid' || !entry.host || !entry.port) {
    return null;
  }

  return {
    host: entry.host,
    port: entry.port,
    username: entry.username,
    password: entry.password,
    type: 'datacenter',
    latencyMs: entry.latencyMs,
    lastCheckedAt: entry.lastCheckedAt,
  };
}

function formatProxyUrl(entry: Pick<ProxyEntry, 'host' | 'port' | 'username' | 'password'>) {
  if (!entry.host || !entry.port) {
    return undefined;
  }

  const auth = entry.username ? `${entry.username}:${entry.password ?? ''}@` : '';
  return `http://${auth}${entry.host}:${entry.port}`;
}

async function measureProxyLatency(entry: ProxyEntry, targetUrl: string) {
  const proxy = formatProxyUrl(entry);
  if (!proxy) {
    return {
      ...entry,
      status: 'invalid' as const,
      latencyMs: undefined,
      error: 'Malformed proxy entry',
      lastCheckedAt: Date.now(),
    };
  }

  const client = createHttpClient({
    fingerprint: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
      ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513-21,29-23-24,0',
      http2: '1:65536;2:0;3:100;4:2097152;6:65536',
    },
    proxy,
    timeout: 12_000,
  });

  const startedAt = Date.now();

  try {
    const response = await client.get(targetUrl, {
      followRedirects: true,
      headers: {
        Referer: targetUrl,
      },
    });

    const latencyMs = Date.now() - startedAt;
    const success = response.status >= 200 && response.status < 400;

    return {
      ...entry,
      status: success ? ('valid' as const) : ('invalid' as const),
      latencyMs,
      error: success ? undefined : `HTTP ${response.status}`,
      lastCheckedAt: Date.now(),
    };
  } catch (error) {
    const proxyError = error as Error;
    return {
      ...entry,
      status: 'invalid' as const,
      latencyMs: undefined,
      error: proxyError.message || 'Speed test failed',
      lastCheckedAt: Date.now(),
    };
  } finally {
    try {
      await client.close();
    } catch {
      // ignore cleanup failure for diagnostics sessions
    }
  }
}

function validateProxyEntry(entry: Partial<ProxyEntry>): ProxyEntry {
  const now = Date.now();
  const raw = entry.raw?.trim() ?? '';

  try {
    const parsed = parseProxyLine(raw);
    return {
      id: entry.id || randomUUID(),
      ...parsed,
      status: 'valid',
      error: undefined,
      latencyMs: undefined,
      lastCheckedAt: now,
    };
  } catch (error) {
    const proxyError = error as Error;
    return {
      id: entry.id || randomUUID(),
      raw,
      status: 'invalid',
      error: proxyError.message,
      latencyMs: undefined,
      lastCheckedAt: now,
    };
  }
}

function normalizeProxyEntry(entry: Partial<ProxyEntry>): ProxyEntry {
  const raw = entry.raw?.trim() ?? '';

  try {
    const parsed = parseProxyLine(raw);
    return {
      id: entry.id || randomUUID(),
      ...parsed,
      status: entry.status ?? 'unchecked',
      error: entry.status === 'invalid' ? entry.error : undefined,
      latencyMs: entry.latencyMs,
      lastCheckedAt: entry.lastCheckedAt,
    };
  } catch (error) {
    const proxyError = error as Error;
    return {
      id: entry.id || randomUUID(),
      raw,
      status: entry.status ?? 'invalid',
      error: entry.error ?? proxyError.message,
      latencyMs: entry.latencyMs,
      lastCheckedAt: entry.lastCheckedAt,
    };
  }
}

function createProxyGroup(name: string, rawInput: string): ProxyGroup {
  const now = Date.now();
  const entries = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => validateProxyEntry({ raw: line }));

  return {
    id: randomUUID(),
    name: name.trim(),
    entries,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeProxyGroup(group: Partial<ProxyGroup>, index: number): ProxyGroup {
  return {
    id: group.id || randomUUID(),
    name: group.name?.trim() || `Imported Group ${index + 1}`,
    entries: Array.isArray(group.entries) ? group.entries.map((entry) => normalizeProxyEntry(entry)) : [],
    createdAt: group.createdAt || Date.now(),
    updatedAt: group.updatedAt || Date.now(),
  };
}

async function loadStoredProfiles() {
  const profiles = await storage.loadPayload<StoredBillingProfile[]>(PROFILES_FILENAME, []);
  return profiles.map((profile) => normalizeProfile(profile));
}

async function loadProfiles() {
  const profiles = await loadStoredProfiles();
  return profiles.map(sanitizeProfile);
}

async function saveProfiles(profiles: BillingProfileInput[]) {
  const currentProfiles = await loadStoredProfiles();
  const currentMap = new Map(currentProfiles.map((profile) => [profile.id, profile]));
  const normalized = profiles.map((profile) => normalizeProfile(profile, profile.id ? currentMap.get(profile.id) : undefined));
  await storage.savePayload(PROFILES_FILENAME, normalized);
  return normalized.map(sanitizeProfile);
}

async function getResolvedProfile(id: string) {
  const profiles = await loadStoredProfiles();
  const match = profiles.find((profile) => profile.id === id);
  return match ? resolveProfile(match) : null;
}

async function loadProxyGroups() {
  const groups = await storage.loadPayload<ProxyGroup[]>(PROXIES_FILENAME, []);
  return groups.map(normalizeProxyGroup);
}

function syncProxyManager(groups: ProxyGroup[]) {
  const groupPools = groups.map((group) => ({
    id: group.id,
    proxies: group.entries.map(toPoolProxy).filter((entry): entry is Proxy => entry !== null),
  }));

  proxyManager.setGroups(groupPools);
}

async function saveProxyGroups(groups: ProxyGroup[]) {
  const normalized = groups.map(normalizeProxyGroup);
  await storage.savePayload(PROXIES_FILENAME, normalized);
  syncProxyManager(normalized);
  return normalized;
}

async function persistTasks() {
  try {
    await storage.savePayload('tasks.json', taskQueue.getAllTasks());
  } catch (error) {
    logger.error('Main: Failed to persist tasks', { error });
  }
}

function setAutoSaveSchedule(seconds: number) {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }

  const intervalMs = Math.max(10, seconds) * 1000;
  autoSaveTimer = setInterval(async () => {
    try {
      await persistTasks();
    } catch (error) {
       // already handled in persistTasks but good to be safe
    }
  }, intervalMs);
}

async function bootstrapQueue() {
  const [config, proxyGroups] = await Promise.all([storage.loadConfig(), loadProxyGroups()]);
  taskQueue.setMaxConcurrent(config.maxConcurrent);
  taskQueue.setProcessingPolicy(config.processingRecheckIntervalSec, config.processingMaxChecks);
  setAutoSaveSchedule(config.autoSaveInterval);
  syncProxyManager(proxyGroups);

  const recoveredTasks = await storage.recoverTasks();
  taskQueue.restoreTasks(recoveredTasks);
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 1100,
    minHeight: 720,
    frame: false,
    backgroundColor: '#0a0a0b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await win.loadURL(devServerUrl);
  } else {
    await win.loadFile(path.join(app.getAppPath(), 'dist', 'renderer', 'index.html'));
  }

  return win;
}

async function exportAppData() {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
  const dialogOptions: SaveDialogOptions = {
    title: 'Export Antigravity Backup',
    defaultPath: 'antigravity-backup.json',
    filters: [{ name: 'JSON Backup', extensions: ['json'] }],
  };
  const dialogResult = targetWindow
    ? await dialog.showSaveDialog(targetWindow, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);

  if (dialogResult.canceled || !dialogResult.filePath) {
    return { success: false, canceled: true };
  }

  const payload: AppBackupPayload = {
    version: 1,
    exportedAt: Date.now(),
    config: await storage.loadConfig(),
    tasks: taskQueue.getAllTasks(),
    profiles: await loadProfiles(),
    proxies: await loadProxyGroups(),
  };

  await fs.writeFile(dialogResult.filePath, JSON.stringify(payload, null, 2), 'utf-8');
  return { success: true, filePath: dialogResult.filePath };
}

async function importAppData() {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
  const dialogOptions: OpenDialogOptions = {
    title: 'Import Antigravity Backup',
    properties: ['openFile'],
    filters: [{ name: 'JSON Backup', extensions: ['json'] }],
  };
  const dialogResult = targetWindow
    ? await dialog.showOpenDialog(targetWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  const filePath = dialogResult.filePaths[0];
  let parsed: any;
  try {
    parsed = JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch (e) {
    return { success: false, error: 'Invalid JSON file' };
  }

  // Basic validation of backup structure
  if (!parsed.version || !Array.isArray(parsed.tasks)) {
    return { success: false, error: 'Incompatible or corrupted backup' };
  }

  const importedConfig: AppConfig = {
    ...DEFAULT_APP_CONFIG,
    ...(parsed.config ?? {}),
  };
  const importedTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const importedProfiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
  const importedProxies = Array.isArray(parsed.proxies) ? parsed.proxies : [];

  try {
    await storage.saveConfig(importedConfig);
    await storage.savePayload('tasks.json', importedTasks);
    await saveProfiles(importedProfiles as BillingProfile[]);
    await saveProxyGroups((importedProxies as Partial<ProxyGroup>[]).map(normalizeProxyGroup));
  } catch (error) {
    logger.error('Main: Failed to save imported data', { error });
    return { success: false, error: 'Failed to write data to disk' };
  }

  taskQueue.setMaxConcurrent(importedConfig.maxConcurrent);
  taskQueue.setProcessingPolicy(importedConfig.processingRecheckIntervalSec, importedConfig.processingMaxChecks);
  setAutoSaveSchedule(importedConfig.autoSaveInterval);
  taskQueue.restoreTasks(await storage.recoverTasks());

  return {
    success: true,
    counts: {
      tasks: importedTasks.length,
      profiles: importedProfiles.length,
      proxyGroups: importedProxies.length,
    },
  };
}

async function wipeAppData() {
  try {
    await storage.saveConfig(DEFAULT_APP_CONFIG);
    await storage.savePayload('tasks.json', []);
    await saveProfiles([]);
    await saveProxyGroups([]);
  } catch (error) {
    logger.error('Main: Failed to wipe app data', { error });
    return { success: false, error: 'Database error' };
  }

  taskQueue.restoreTasks([]);
  taskQueue.setMaxConcurrent(DEFAULT_APP_CONFIG.maxConcurrent);
  taskQueue.setProcessingPolicy(
    DEFAULT_APP_CONFIG.processingRecheckIntervalSec,
    DEFAULT_APP_CONFIG.processingMaxChecks,
  );
  setAutoSaveSchedule(DEFAULT_APP_CONFIG.autoSaveInterval);

  return { success: true };
}

app.whenReady().then(async () => {
  await initializeTLS();
  await bootstrapQueue();
  mainWindow = await createWindow();

  taskQueue.on('task:status', (payload) => {
    broadcast(TASK_STATUS_CHANNEL, payload);
  });

  taskQueue.on('task:log', (payload) => {
    broadcast(TASK_LOG_CHANNEL, payload);
  });

  if (!isDevelopment) {
    setupAutoUpdater();
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let isQuitting = false;
app.on('before-quit', async (event) => {
  if (isQuitting) return;

  event.preventDefault();
  isQuitting = true;

  logger.info('Main: preparing to quit, saving tasks and cleaning up.');
  
  try {
    // Await all critical persistence and cleanup tasks
    await Promise.all([
      persistTasks(),
      taskQueue.cleanupAll(),
    ]);
    // Await TLS termination separately to ensure it happens after sessions ideally, 
    // though taskQueue.cleanupAll should handle worker destruction which closes sessions.
    await terminateTLS();
    logger.info('Main: Cleanup complete. Quitting app.');
  } catch (error) {
    logger.error('Main: Error during quit cleanup', { error });
  } finally {
    app.quit();
  }
});

ipcMain.handle('tasks:get-all', () => {
  return taskQueue.getAllTasks();
});

ipcMain.handle('tasks:get-stats', () => {
  return taskQueue.getStats();
});

ipcMain.handle(
  'tasks:operate',
  async (_event, payload: { action: 'start' | 'pause' | 'cancel' | 'retry'; ids: string[] }) => {
    const { action, ids } = payload;

    try {
      for (const id of ids) {
        const taskId = id as TaskId;
        switch (action) {
          case 'start':
            taskQueue.resumeTask(taskId);
            break;
          case 'retry':
            taskQueue.retryTask(taskId);
            break;
          case 'pause':
            taskQueue.pauseTask(taskId);
            break;
          case 'cancel':
            taskQueue.cancelTask(taskId);
            break;
        }
      }

      await persistTasks();
      return { success: true };
    } catch (error) {
      logger.error('IPC: tasks:operate failed', { error });
      throw error;
    }
  },
);

ipcMain.handle('tasks:add', async (_event, input) => {
  try {
    const task = createSupremeTask(input);
    taskQueue.addTask(task);
    await persistTasks();
    return { success: true, task };
  } catch (error) {
    logger.error('IPC: tasks:add failed', { error });
    throw error;
  }
});

ipcMain.handle('tasks:update', async (_event, { id, updates }) => {
  try {
    taskQueue.updateTask(id as TaskId, updates);
    await persistTasks();
    return { success: true };
  } catch (error) {
    logger.error('IPC: tasks:update failed', { error });
    throw error;
  }
});

ipcMain.handle('tasks:clear-logs', async (_event, id: string) => {
  try {
    taskQueue.clearTaskLogs(id as TaskId);
    await persistTasks();
    return { success: true };
  } catch (error) {
    logger.error('IPC: tasks:clear-logs failed', { error });
    throw error;
  }
});

ipcMain.handle('profiles:get-all', async () => {
  return loadProfiles();
});

ipcMain.handle('profiles:save-all', async (_event, profiles: BillingProfileInput[]) => {
  const savedProfiles = await saveProfiles(profiles);
  return { success: true, profiles: savedProfiles };
});

ipcMain.handle('profiles:import-csv', async () => {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
  const dialogOptions: OpenDialogOptions = {
    title: 'Import Profiles CSV',
    properties: ['openFile'],
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
  };
  const dialogResult = targetWindow
    ? await dialog.showOpenDialog(targetWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  const csv = await fs.readFile(dialogResult.filePaths[0], 'utf-8');
  const importedProfiles = parseProfilesCsv(csv);
  const currentProfiles = await loadProfiles();
  const nextProfiles = [...currentProfiles];

  for (const profile of importedProfiles) {
    const existingIndex = nextProfiles.findIndex(
      (candidate) =>
        candidate.id === profile.id ||
        (candidate.email === profile.email && candidate.last4 === profile.last4 && candidate.email !== ''),
    );
    if (existingIndex >= 0) {
      nextProfiles[existingIndex] = profile;
    } else {
      nextProfiles.push(profile);
    }
  }

  const savedProfiles = await saveProfiles(nextProfiles);
  return {
    success: true,
    profiles: savedProfiles,
    importedCount: importedProfiles.length,
  };
});

ipcMain.handle('profiles:export-csv', async () => {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
  const dialogOptions: SaveDialogOptions = {
    title: 'Export Profiles CSV',
    defaultPath: 'profiles.csv',
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
  };
  const dialogResult = targetWindow
    ? await dialog.showSaveDialog(targetWindow, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);

  if (dialogResult.canceled || !dialogResult.filePath) {
    return { success: false, canceled: true };
  }

  const profiles = await loadProfiles();
  await fs.writeFile(dialogResult.filePath, profilesToCsv(profiles), 'utf-8');
  return { success: true, exportedCount: profiles.length };
});

ipcMain.handle('proxies:get-all', async () => {
  return loadProxyGroups();
});

ipcMain.handle('proxies:create-group', async (_event, payload: { name: string; rawInput: string }) => {
  const nextGroup = createProxyGroup(payload.name, payload.rawInput);
  const groups = await loadProxyGroups();
  const savedGroups = await saveProxyGroups([...groups, nextGroup]);
  return { success: true, groups: savedGroups };
});

ipcMain.handle('proxies:remove-group', async (_event, id: string) => {
  const groups = await loadProxyGroups();
  const savedGroups = await saveProxyGroups(groups.filter((group) => group.id !== id));
  return { success: true, groups: savedGroups };
});

ipcMain.handle('proxies:validate-all', async () => {
  const groups = await loadProxyGroups();
  const validatedGroups = groups.map((group) => ({
    ...group,
    entries: group.entries.map((entry) => validateProxyEntry(entry)),
    updatedAt: Date.now(),
  }));
  const savedGroups = await saveProxyGroups(validatedGroups);
  return { success: true, groups: savedGroups };
});

ipcMain.handle(
  'proxies:test-speed',
  async (_event, payload?: { groupId?: string; targetUrl?: string }) => {
    try {
      const groups = await loadProxyGroups();
      const config = await storage.loadConfig();
      const targetUrl = payload?.targetUrl?.trim() || config.proxySpeedTestUrl;

      const nextGroups = await Promise.all(
        groups.map(async (group) => {
          if (payload?.groupId && group.id !== payload.groupId) {
            return group;
          }

          const nextEntries = await Promise.all(
            group.entries.map(async (entry) => measureProxyLatency(entry, targetUrl)),
          );

          return {
            ...group,
            entries: nextEntries,
            updatedAt: Date.now(),
          };
        }),
      );

      const savedGroups = await saveProxyGroups(nextGroups);
      return { success: true, groups: savedGroups };
    } catch (error: any) {
      logger.error('IPC: proxies:test-speed failed', { error });
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle('config:get', async () => {
  return storage.loadConfig();
});

ipcMain.handle('config:save', async (_event, config: AppConfig) => {
  try {
    await storage.saveConfig(config);
    taskQueue.setMaxConcurrent(config.maxConcurrent);
    taskQueue.setProcessingPolicy(config.processingRecheckIntervalSec, config.processingMaxChecks);
    setAutoSaveSchedule(config.autoSaveInterval);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('webhook:test', async (_event, url: string) => {
  try {
    await sendDiscordWebhook(url, {
      embeds: [
        {
          title: 'Webhook Test: Antigravity',
          description: 'The Discord webhook is configured and reachable.',
          color: 0x00ffd0,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    return { success: true };
  } catch (error) {
    const webhookError = error as Error;
    logger.error('IPC: webhook:test failed', { error: webhookError.message });
    return { success: false, error: webhookError.message };
  }
});

ipcMain.handle('app-data:export', async () => {
  return exportAppData();
});

ipcMain.handle('app-data:import', async () => {
  return importAppData();
});

ipcMain.handle('app-data:wipe', async () => {
  return wipeAppData();
});

ipcMain.handle('app:open-external', async (_event, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    logger.error('IPC: app:open-external failed', { error, url });
    return { success: false };
  }
});

ipcMain.on('window-controls', (_event, action: 'minimize' | 'close') => {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
  if (!win) {
    return;
  }

  if (action === 'minimize') {
    win.minimize();
  }

  if (action === 'close') {
    win.close();
  }
});
