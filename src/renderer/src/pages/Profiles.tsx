/**
 * @file src/renderer/src/pages/Profiles.tsx
 * @description 프로필 관리 페이지 (암호화된 결제 정보 관리)
 */

import React from 'react';
import { 
  Plus, 
  CreditCard, 
  MapPin, 
  Mail, 
  Search,
  CheckCircle2,
  Lock
} from 'lucide-react';

export const Profiles: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[900px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            <CreditCard size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest italic">Billing Profiles</h2>
            <p className="text-[10px] text-text-muted font-bold tracking-tight">ENCRYPTED WITH AES-256-GCM</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
            <input 
              type="text" 
              placeholder="SEARCH PROFILES..." 
              className="bg-surface/50 border border-white/5 rounded-xl pl-10 pr-6 py-2.5 w-64 focus:outline-none focus:border-primary/50 text-[10px] font-bold"
            />
          </div>
          <button className="flex items-center gap-2 bg-valor-accent/10 hover:bg-valor-accent/20 text-valor-accent border border-valor-accent/20 px-6 py-2.5 rounded-xl transition-all text-[10px] font-black italic uppercase">
            <Plus size={14} />
            NEW PROFILE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {[1, 2].map((_, i) => (
          <div key={i} className="glass-card group overflow-hidden border-white/5 hover:border-primary/30 transition-all cursor-pointer">
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-valor-accent p-[1px]">
                    <div className="w-full h-full bg-surface rounded-xl flex items-center justify-center">
                      <CreditCard size={20} className="text-primary" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider italic">Main Capital One</h4>
                    <p className="text-[10px] text-text-muted font-bold font-mono">**** **** **** 1240</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-valor-accent">
                  <CheckCircle2 size={12} />
                  <span className="text-[9px] font-black uppercase italic">VALIDATED</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <MapPin size={14} className="text-text-muted" />
                    <div className="text-[10px] font-bold uppercase tracking-wide">
                      <p>New York, NY</p>
                      <p className="text-text-muted">100 Broadway</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail size={14} className="text-text-muted" />
                    <p className="text-[10px] font-bold uppercase truncate">user@email.com</p>
                  </div>
                </div>
                <div className="flex flex-col justify-end items-end gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 group-hover:border-primary/30 transition-all">
                    <Lock size={12} className="text-text-muted" />
                    <span className="text-[10px] font-black italic uppercase tracking-tighter">ENCRYPTED</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-primary to-valor-accent opacity-30 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>

      {/* Import/Export Card */}
      <div className="glass-card p-4 flex items-center justify-between border-dashed border-white/10">
        <p className="text-[10px] font-bold text-text-muted uppercase italic px-2">Need to move your profiles? Use .valor backup in settings.</p>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-black uppercase transition-all">Import AYCD</button>
          <button className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-black uppercase transition-all">Export CSV</button>
        </div>
      </div>
    </div>
  );
};
