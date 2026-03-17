/**
 * @file src/renderer/src/main.tsx
 * @description 메인 앱 엔트리 (전역 IPC 리스너 및 Zustand 연동)
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useTaskStore } from './stores/taskStore'

// 전역 IPC 리스너 설정
const setupIpcListeners = () => {
  const api = (window as any).electronAPI;

  if (api) {
    // 태스크 상태 업데이트 구독
    api.onTaskUpdate((state: any) => {
      useTaskStore.getState().updateTaskState(state.id, state);
    });

    // 태스크 로그 업데이트 구독
    api.onTaskLog((log: any) => {
      useTaskStore.getState().addLog(log);
    });
  }
};

setupIpcListeners();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
