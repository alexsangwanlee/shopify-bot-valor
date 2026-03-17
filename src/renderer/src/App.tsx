/**
 * @file src/renderer/src/App.tsx
 * @description 메인 앱 엔트리 (레이지 로딩 및 탭 전환)
 */

import React, { useState, Suspense, lazy } from 'react';
import { Layout } from './components/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Tasks = lazy(() => import('./pages/Tasks').then(m => ({ default: m.Tasks })));
const Proxies = lazy(() => import('./pages/Proxies').then(m => ({ default: m.Proxies })));
// Profiles, Monitor, Settings 는 현재 placeholder 로 생성 필요 또는 lazy 처리 유지

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-full text-valor-accent animate-pulse">LOADING...</div>}>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'tasks' && <Tasks />}
        {activeTab === 'proxies' && <Proxies />}
        {/* 추가 페이지 구현 시 여기에 연결 */}
      </Suspense>
    );
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

export default App;
