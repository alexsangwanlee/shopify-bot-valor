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
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'tasks', icon: ListTodo, label: 'Tasks' },
    { id: 'proxies', icon: ShieldCheck, label: 'Proxies' },
    { id: 'profiles', icon: Users, label: 'Profiles' },
    { id: 'monitor', icon: MonitorIcon, label: 'Monitor' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex flex-col h-screen bg-background text-text select-none overflow-hidden border border-white/5 rounded-lg">
      <TopBar />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[180px] bg-surface/30 flex flex-col border-r border-white/5 h-full">
          <div className="p-6">
            <h1 className="text-sm font-black tracking-[0.2em] text-valor-accent italic">
              ANTIGRAVITY
            </h1>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg transition-all text-xs font-bold leading-none uppercase tracking-wider
                  ${activeTab === item.id 
                    ? 'bg-valor-accent/10 text-valor-accent shadow-accent-glow border border-valor-accent/20' 
                    : 'text-text-muted hover:text-text hover:bg-white/5'}`}
              >
                <item.icon size={16} strokeWidth={activeTab === item.id ? 3 : 2} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden relative bg-[#0c0c0e]">
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-valor-accent/5 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none" />
          
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {children}
          </div>
        </main>
      </div>

      <StatusBar />
    </div>
  );
};
