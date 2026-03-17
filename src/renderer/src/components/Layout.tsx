/**
 * @file src/renderer/src/components/Layout.tsx
 * @description 전체 애플리케이션 레이아웃 (Sidebar, TopBar, StatusBar 포함)
 */

import React from 'react';
import { 
  LayoutDashboard, 
  ListTodo, 
  ShieldCheck, 
  Users, 
  Monitor as MonitorIcon, 
  Settings 
} from 'lucide-react';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'dashboard' | 'tasks' | 'proxies' | 'profiles' | 'monitor' | 'settings';
  setActiveTab: React.Dispatch<
    React.SetStateAction<'dashboard' | 'tasks' | 'proxies' | 'profiles' | 'monitor' | 'settings'>
  >;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const navItems: Array<{
    id: LayoutProps['activeTab'];
    icon: typeof LayoutDashboard;
    label: string;
  }> = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'tasks', icon: ListTodo, label: 'Tasks' },
    { id: 'proxies', icon: ShieldCheck, label: 'Proxies' },
    { id: 'profiles', icon: Users, label: 'Profiles' },
    { id: 'monitor', icon: MonitorIcon, label: 'Monitor' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen select-none overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/30 text-text shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <aside className="relative flex h-full w-[240px] flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] px-4 pb-5 pt-5">
          <div className="pointer-events-none absolute inset-x-4 top-4 h-28 rounded-[2rem] bg-gradient-to-br from-valor-accent/12 via-transparent to-blue-500/10 blur-2xl" />

          <div className="relative px-4 pb-6 pt-3">
            <div className="section-kicker">Antigravity</div>
            <h1 className="mt-3 text-[1.45rem] font-black uppercase italic tracking-[0.18em] text-white">
              Control Deck
            </h1>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
              local checkout telemetry and queue control
            </p>
          </div>

          <nav className="relative flex-1 space-y-2 px-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`group flex w-full items-center gap-3 rounded-[1.2rem] px-4 py-3.5 text-left text-xs font-black uppercase leading-none tracking-[0.18em] transition-all
                  ${activeTab === item.id 
                    ? 'border border-valor-accent/20 bg-valor-accent/12 text-valor-accent shadow-accent-glow' 
                    : 'border border-transparent text-text-muted hover:border-white/10 hover:bg-white/[0.04] hover:text-text'}`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                    activeTab === item.id
                      ? 'bg-valor-accent/15 text-valor-accent'
                      : 'bg-white/[0.04] text-white/35 group-hover:text-white/70'
                  }`}
                >
                  <item.icon size={16} strokeWidth={activeTab === item.id ? 3 : 2.2} />
                </span>
                <div className="flex flex-1 items-center justify-between">
                  <span>{item.label}</span>
                  {activeTab === item.id ? (
                    <span className="h-2 w-2 rounded-full bg-valor-accent shadow-accent-glow" />
                  ) : null}
                </div>
              </button>
            ))}
          </nav>

          <div className="glass-card relative mt-4 overflow-hidden border-white/10 p-4">
            <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-valor-accent/50 to-transparent" />
            <div className="section-kicker">System Note</div>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">
              Fast queues, clean proxy pools, sharp monitor intervals.
            </p>
            <p className="mt-3 text-[10px] font-bold leading-relaxed text-white/30">
              Use Tasks for queue flow, Proxies for route quality, and Monitor for catch coverage.
            </p>
          </div>
        </aside>

        <main className="relative flex flex-1 flex-col overflow-hidden bg-[#07101c]/70">
          <div className="pointer-events-none absolute -left-10 top-12 h-72 w-72 rounded-full bg-valor-accent/8 blur-[120px]" />
          <div className="pointer-events-none absolute -right-20 top-0 h-96 w-96 rounded-full bg-blue-500/8 blur-[140px]" />
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="flex-1 overflow-y-auto p-7 custom-scrollbar xl:p-8">
            {children}
          </div>
        </main>
      </div>

      <StatusBar />
    </div>
  );
};
