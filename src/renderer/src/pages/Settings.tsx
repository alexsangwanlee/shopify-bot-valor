import React, { useEffect, useState } from 'react';
import {
  Bell,
  Check,
  Cpu,
  Download,
  Moon,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  Webhook,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Settings: React.FC = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [maxConcurrent, setMaxConcurrent] = useState(50);
  const [autoSaveInterval, setAutoSaveInterval] = useState(30);
  const [processingRecheckIntervalSec, setProcessingRecheckIntervalSec] = useState(5);
  const [processingMaxChecks, setProcessingMaxChecks] = useState(24);
  const [monitorDefaultPollIntervalSec, setMonitorDefaultPollIntervalSec] = useState(2);
  const [proxySpeedTestUrl, setProxySpeedTestUrl] = useState('https://www.supremenewyork.com/shop/all');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      const config = await window.electronAPI.getConfig();
      setWebhookUrl(config.webhookUrl);
      setMaxConcurrent(config.maxConcurrent);
      setAutoSaveInterval(config.autoSaveInterval);
      setProcessingRecheckIntervalSec(config.processingRecheckIntervalSec);
      setProcessingMaxChecks(config.processingMaxChecks);
      setMonitorDefaultPollIntervalSec(config.monitorDefaultPollIntervalSec);
      setProxySpeedTestUrl(config.proxySpeedTestUrl);
      setNotificationsEnabled(config.notificationsEnabled);
    };

    void loadConfig();
  }, []);

  const handleSave = async () => {
    const response = await window.electronAPI.saveConfig({
      webhookUrl,
      maxConcurrent,
      autoSaveInterval,
      processingRecheckIntervalSec,
      processingMaxChecks,
      monitorDefaultPollIntervalSec,
      proxySpeedTestUrl,
      notificationsEnabled,
    });

    if (!response.success) {
      alert(`Failed to save configuration: ${response.error ?? 'Unknown error'}`);
      return;
    }

    setSaveSuccess(true);
    window.setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      alert('Please enter a webhook URL first.');
      return;
    }

    const response = await window.electronAPI.testWebhook(webhookUrl);
    if (!response.success) {
      alert(`Webhook test failed: ${response.error ?? 'Unknown error'}`);
      return;
    }

    alert('Webhook test sent successfully.');
  };

  const handleExportData = async () => {
    setIsBusy(true);
    try {
      const response = await window.electronAPI.exportAppData();
      if (!response.success || response.canceled) {
        return;
      }

      alert(`Backup exported to:\n${response.filePath}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportData = async () => {
    setIsBusy(true);
    try {
      const response = await window.electronAPI.importAppData();
      if (!response.success || response.canceled) {
        return;
      }

      alert(
        `Imported backup.\nTasks: ${response.counts?.tasks ?? 0}\nProfiles: ${
          response.counts?.profiles ?? 0
        }\nProxy groups: ${response.counts?.proxyGroups ?? 0}`,
      );
      window.location.reload();
    } finally {
      setIsBusy(false);
    }
  };

  const handleWipeData = async () => {
    const confirmed = window.confirm(
      'This will remove all local tasks, profiles, proxy groups, and configuration. Continue?',
    );

    if (!confirmed) {
      return;
    }

    setIsBusy(true);
    try {
      await window.electronAPI.wipeAppData();
      alert('All local app data has been cleared.');
      window.location.reload();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="max-w-[900px] space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-xl font-black uppercase tracking-[0.25em] italic text-white leading-tight">
            System Settings
          </h2>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-valor-accent" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 italic">
              Local runtime configuration
            </span>
          </div>
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={saveSuccess || isBusy}
          className={cn(
            'flex items-center gap-3 rounded-2xl px-10 py-4 text-xs font-black uppercase italic tracking-widest transition-all shadow-accent-glow active:scale-95',
            saveSuccess ? 'bg-emerald-500 text-white' : 'bg-valor-accent text-white hover:brightness-110',
          )}
        >
          {saveSuccess ? <Check size={18} strokeWidth={3} /> : <Save size={18} strokeWidth={3} />}
          {saveSuccess ? 'Config Synced' : 'Save Configuration'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="glass-card space-y-8 border-white/5 p-8">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-valor-accent/20 bg-valor-accent/10 p-3 text-valor-accent">
              <ShieldCheck size={24} />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-widest italic text-white">
                General Engine
              </h3>
              <span className="text-[9px] font-bold uppercase tracking-tight text-white/20">
                Core behavior and notifications
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center gap-4">
                <div className="rounded-xl border border-white/10 bg-[#0a0a0b] p-2.5 text-valor-accent">
                  <Moon size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase italic tracking-wider text-white">
                    Dark Mode
                  </p>
                  <p className="text-[9px] font-bold uppercase text-white/20">
                    Active by design while the theme system is still single-mode
                  </p>
                </div>
              </div>
              <div className="rounded-full border border-valor-accent/30 bg-valor-accent/20 px-3 py-1 text-[10px] font-black uppercase italic text-valor-accent">
                Locked
              </div>
            </div>

            <button
              onClick={() => setNotificationsEnabled((current) => !current)}
              className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-left transition-all hover:border-valor-accent/30"
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'rounded-xl border border-white/10 bg-[#0a0a0b] p-2.5 transition-colors',
                    notificationsEnabled ? 'text-valor-accent' : 'text-white/40',
                  )}
                >
                  <Bell size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase italic tracking-wider text-white">
                    OS Notifications
                  </p>
                  <p className="text-[9px] font-bold uppercase text-white/20">
                    Used for both checkout success and checkout failure alerts
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  'relative h-6 w-12 rounded-full border p-1 transition-all',
                  notificationsEnabled
                    ? 'border-valor-accent/30 bg-valor-accent/20'
                    : 'border-white/10 bg-white/5',
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 h-4 w-4 rounded-full transition-all',
                    notificationsEnabled
                      ? 'right-1 bg-valor-accent shadow-accent-glow'
                      : 'left-1 bg-white/20',
                  )}
                />
              </div>
            </button>
          </div>
        </div>

        <div className="glass-card space-y-8 border-white/5 p-8">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-blue-400">
              <Webhook size={24} />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-widest italic text-white">
                Discord Webhook
              </h3>
              <span className="text-[9px] font-bold uppercase tracking-tight text-white/20">
                Success and failure checkout alerts
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
              Webhook URL
            </label>
            <input
              type="text"
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-bold text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
            />
            <button
              onClick={() => void handleTestWebhook()}
              disabled={isBusy}
              className="w-full rounded-2xl border border-blue-500/20 bg-blue-500/10 py-4 text-[10px] font-black uppercase italic tracking-widest text-blue-400 transition-all hover:bg-blue-500/20 active:scale-95"
            >
              Broadcast Test Payload
            </button>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/20">
              When configured, Discord receives both checkout success and checkout failure embeds.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="glass-card space-y-8 border-white/5 p-8">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-400">
              <Cpu size={24} />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-widest italic text-white">
                Worker Thread Pool
              </h3>
              <span className="text-[9px] font-bold uppercase tracking-tight text-white/20">
                Concurrency and persistence
              </span>
            </div>
          </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-black uppercase tracking-widest italic text-white/20">
                  Max Concurrent Tasks
                </p>
                <span className="font-mono text-xs font-black italic text-valor-accent">
                  {maxConcurrent} NODES
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="200"
                value={maxConcurrent}
                onChange={(event) => setMaxConcurrent(parseInt(event.target.value, 10))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full border border-white/5 bg-[#0a0a0b] accent-valor-accent"
              />
            </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black uppercase tracking-widest italic text-white/20">
                    Auto-Save Persistent State
                </p>
                <span className="font-mono text-xs font-black italic text-blue-400">
                  {autoSaveInterval} SECONDS
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="300"
                value={autoSaveInterval}
                onChange={(event) => setAutoSaveInterval(parseInt(event.target.value, 10))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full border border-white/5 bg-[#0a0a0b] accent-blue-400"
              />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                  This now controls periodic task-state snapshots in the main process.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black uppercase tracking-widest italic text-white/20">
                    Monitor Catch Speed
                  </p>
                  <span className="font-mono text-xs font-black italic text-amber-300">
                    {monitorDefaultPollIntervalSec} SECONDS
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={monitorDefaultPollIntervalSec}
                  onChange={(event) => setMonitorDefaultPollIntervalSec(parseInt(event.target.value, 10))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full border border-white/5 bg-[#0a0a0b] accent-amber-300"
                />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                  Default poll speed for new monitor tasks. Lower is faster and heavier on proxies.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black uppercase tracking-widest italic text-white/20">
                    Processing Recheck Interval
                  </p>
                  <span className="font-mono text-xs font-black italic text-cyan-300">
                    {processingRecheckIntervalSec} SECONDS
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={processingRecheckIntervalSec}
                  onChange={(event) => setProcessingRecheckIntervalSec(parseInt(event.target.value, 10))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full border border-white/5 bg-[#0a0a0b] accent-cyan-300"
                />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                  Used for automatic checkout verification after 3DS or bank processing.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black uppercase tracking-widest italic text-white/20">
                    Processing Max Checks
                  </p>
                  <span className="font-mono text-xs font-black italic text-cyan-300">
                    {processingMaxChecks} PASSES
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={processingMaxChecks}
                  onChange={(event) => setProcessingMaxChecks(parseInt(event.target.value, 10))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full border border-white/5 bg-[#0a0a0b] accent-cyan-300"
                />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                  Caps how long the engine keeps polling before marking a stuck checkout as failed.
                </p>
              </div>

              <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                  Proxy Speed Test URL
                </label>
                <input
                  type="text"
                  value={proxySpeedTestUrl}
                  onChange={(event) => setProxySpeedTestUrl(event.target.value)}
                  placeholder="https://www.supremenewyork.com/shop/all"
                  className="w-full rounded-2xl border border-white/10 bg-[#0a0a0b] px-5 py-4 text-xs font-bold text-white placeholder:text-white/10 focus:border-valor-accent/50 focus:outline-none"
                />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                  Used by the proxy speed lab to measure real request latency against your target store.
                </p>
              </div>
            </div>
          </div>

        <div className="glass-card space-y-8 border-white/5 p-8">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-red-400">
              <Trash2 size={24} />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-widest italic text-white">
                Local Data
              </h3>
              <span className="text-[9px] font-bold uppercase tracking-tight text-white/20">
                Backup, restore, and reset
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => void handleExportData()}
              disabled={isBusy}
              className="group flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] py-4 transition-all hover:bg-white/[0.08] active:scale-95"
            >
              <Download size={16} className="text-white/20 transition-colors group-hover:text-valor-accent" />
              <span className="text-[10px] font-black uppercase italic tracking-widest text-white/60">
                Export Backup
              </span>
            </button>
            <button
              onClick={() => void handleImportData()}
              disabled={isBusy}
              className="group flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] py-4 transition-all hover:bg-white/[0.08] active:scale-95"
            >
              <Upload size={16} className="text-white/20 transition-colors group-hover:text-blue-400" />
              <span className="text-[10px] font-black uppercase italic tracking-widest text-white/60">
                Import Backup
              </span>
            </button>
            <button
              onClick={() => void handleWipeData()}
              disabled={isBusy}
              className="col-span-2 flex items-center justify-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 py-4 text-red-400 transition-all hover:bg-red-500/20 active:scale-[0.98]"
            >
              <Trash2 size={16} />
              <span className="text-[10px] font-black uppercase italic tracking-widest">
                Wipe All Tasks, Profiles, Proxies, and Configuration
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
