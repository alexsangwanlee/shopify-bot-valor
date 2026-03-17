import React, { Suspense, lazy, useState } from 'react';
import { Layout } from './components/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Tasks = lazy(() => import('./pages/Tasks').then((module) => ({ default: module.Tasks })));
const Proxies = lazy(() => import('./pages/Proxies').then((module) => ({ default: module.Proxies })));
const Profiles = lazy(() => import('./pages/Profiles').then((module) => ({ default: module.Profiles })));
const Monitor = lazy(() => import('./pages/Monitor').then((module) => ({ default: module.Monitor })));
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));

type TabId = 'dashboard' | 'tasks' | 'proxies' | 'profiles' | 'monitor' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <Suspense
        fallback={
          <div className="glass-card-intense flex h-full min-h-[360px] flex-col items-center justify-center gap-4 border-white/10 text-center animate-in fade-in duration-500">
            <div className="section-kicker">Boot Sequence</div>
            <div className="panel-title">Loading Control Surface</div>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-valor-accent via-cyan-300 to-blue-400" />
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/30">
              syncing local engine modules
            </div>
          </div>
        }
      >
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'tasks' && <Tasks />}
        {activeTab === 'proxies' && <Proxies />}
        {activeTab === 'profiles' && <Profiles />}
        {activeTab === 'monitor' && <Monitor />}
        {activeTab === 'settings' && <Settings />}
      </Suspense>
    </Layout>
  );
}

export default App;
