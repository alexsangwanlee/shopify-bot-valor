/**
 * @file src/renderer/src/pages/Settings.tsx
 * @description 애플리케이션 설정 페이지 (테마, 알림, 웹훅, 백업 관리)
 */

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Moon, 
  Webhook, 
  Download, 
  Upload, 
  ShieldCheck,
  Cpu,
  Trash2,
  Save,
  Check
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Settings: React.FC = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [maxConcurrent, setMaxConcurrent] = useState(50);
  const [autoSaveInternal, setAutoSaveInterval] = useState(30);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 로드 설정
  useEffect(() => {
    const loadConfig = async () => {
      const config = await window.electronAPI.getConfig();
      setWebhookUrl(config.webhookUrl);
      setMaxConcurrent(config.maxConcurrent);
      setAutoSaveInterval(config.autoSaveInterval);
      setNotificationsEnabled(config.notificationsEnabled);
    };
    loadConfig();
  }, []);

  const handleSave = async () => {
    await window.electronAPI.saveConfig({
      webhookUrl,
      maxConcurrent,
      autoSaveInterval: autoSaveInternal,
      notificationsEnabled
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) return alert('Please enter a webhook URL first.');
    try {
      await window.electronAPI.testWebhook(webhookUrl);
    } catch (err: any) {
      alert(`Webhook test failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-[900px]">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-xl font-black uppercase tracking-[0.25em] italic text-white leading-tight">System Settings</h2>
          <div className="flex items-center gap-2 mt-1">
             <div className="w-1.5 h-1.5 rounded-full bg-valor-accent" />
             <span className="text-[10px] font-black text-white/30 tracking-[0.3em] uppercase italic">Valor Engine v2.0.4 Config</span>
          </div>
        </div>
        <button 
          onClick={handleSave}
          disabled={saveSuccess}
          className={cn(
            "flex items-center gap-3 px-10 py-4 rounded-2xl transition-all text-xs font-black italic uppercase tracking-widest shadow-accent-glow active:scale-95",
            saveSuccess ? "bg-emerald-500 text-white" : "bg-valor-accent text-white hover:brightness-110"
          )}
        >
          {saveSuccess ? <Check size={18} strokeWidth={3} /> : <Save size={18} strokeWidth={3} />} 
          {saveSuccess ? 'CONFIG SYNCED' : 'SAVE CONFIGURATION'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* General Settings */}
        <div className="glass-card p-8 space-y-8 border-white/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-valor-accent/10 text-valor-accent rounded-2xl border border-valor-accent/20">
              <ShieldCheck size={24} />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-widest italic text-white">General Engine</h3>
              <span className="text-[9px] font-bold text-white/20 uppercase tracking-tight">Core behavior & notifications</span>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 group hover:border-valor-accent/30 transition-all">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-[#0a0a0b] border border-white/10 rounded-xl text-white/40 group-hover:text-valor-accent transition-colors">
                  <Moon size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase italic tracking-wider text-white">Dark Mode</p>
                  <p className="text-[9px] font-bold text-white/20 uppercase">Follow system preferences</p>
                </div>
              </div>
              <div className="w-12 h-6 bg-valor-accent rounded-full relative border border-valor-accent/30 cursor-pointer p-1">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-lg" />
              </div>
            </div>

            <div 
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 group hover:border-valor-accent/30 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className={cn("p-2.5 bg-[#0a0a0b] border border-white/10 rounded-xl transition-colors", notificationsEnabled ? "text-valor-accent" : "text-white/40")}>
                  <Bell size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase italic tracking-wider text-white">OS Notifications</p>
                  <p className="text-[9px] font-bold text-white/20 uppercase">Critical system alerts</p>
                </div>
              </div>
              <div className={cn("w-12 h-6 rounded-full relative border transition-all p-1", notificationsEnabled ? "bg-valor-accent/20 border-valor-accent/30" : "bg-white/5 border-white/10")}>
                <div className={cn("absolute top-1 w-4 h-4 bg-valor-accent rounded-full shadow-accent-glow transition-all", notificationsEnabled ? "right-1" : "left-1 bg-white/20 shadow-none")} />
              </div>
            </div>
          </div>
        </div>

        {/* Discord Webhook */}
        <div className="glass-card p-8 space-y-8 border-white/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
              <Webhook size={24} />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-widest italic text-white">Discord Webhook</h3>
              <span className="text-[9px] font-bold text-white/20 uppercase tracking-tight">External result tracking</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-1">WEBHOOK URL</label>
            <input 
              type="text" 
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..." 
              className="w-full bg-[#0a0a0b] border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-valor-accent/50 text-xs font-bold text-white transition-all placeholder:text-white/10"
            />
            <button 
              onClick={handleTestWebhook}
              className="w-full py-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-2xl text-[10px] font-black transition-all uppercase italic tracking-widest shadow-xl shadow-black/20 active:scale-95"
            >
              BROADCAST TEST PAYLOAD
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="glass-card p-8 space-y-8 border-white/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <Cpu size={24} />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-widest italic text-white">Worker Thread Pool</h3>
              <span className="text-[9px] font-bold text-white/20 uppercase tracking-tight">Concurrency limits</span>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest italic">MAX CONCURRENT TASKS</p>
                <span className="text-xs font-black text-valor-accent italic font-mono">{maxConcurrent} NODES</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="200" 
                value={maxConcurrent}
                onChange={(e) => setMaxConcurrent(parseInt(e.target.value))}
                className="w-full h-1.5 bg-[#0a0a0b] rounded-full appearance-none cursor-pointer accent-valor-accent border border-white/5" 
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest italic">Auto-Save Persistent State</p>
                <span className="text-xs font-black text-blue-400 italic font-mono">{autoSaveInternal} SECONDS</span>
              </div>
              <input 
                type="range" 
                min="10" 
                max="300" 
                value={autoSaveInternal}
                onChange={(e) => setAutoSaveInterval(parseInt(e.target.value))}
                className="w-full h-1.5 bg-[#0a0a0b] rounded-full appearance-none cursor-pointer accent-blue-400 border border-white/5" 
              />
            </div>
          </div>
        </div>

        <div className="glass-card p-8 space-y-8 border-white/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20">
              <Trash2 size={24} />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-widest italic text-white">Danger Zone</h3>
              <span className="text-[9px] font-bold text-white/20 uppercase tracking-tight">System reset & recovery</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-3 py-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-2xl transition-all group active:scale-95">
              <Download size={16} className="text-white/20 group-hover:text-valor-accent transition-colors" />
              <span className="text-[10px] font-black uppercase italic tracking-widest text-white/60">Export DB</span>
            </button>
            <button className="flex items-center justify-center gap-3 py-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-2xl transition-all group active:scale-95">
              <Upload size={16} className="text-white/20 group-hover:text-blue-400 transition-colors" />
              <span className="text-[10px] font-black uppercase italic tracking-widest text-white/60">Import DB</span>
            </button>
            <button className="col-span-2 flex items-center justify-center gap-3 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl transition-all active:scale-[0.98]">
              <Trash2 size={16} />
              <span className="text-[10px] font-black uppercase italic tracking-widest">Wipe All Tasks & Configuration</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
