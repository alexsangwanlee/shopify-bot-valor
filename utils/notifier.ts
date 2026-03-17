/**
 * @file utils/notifier.ts
 * @description OS 알림 및 사운드 효과를 관리하는 유틸리티
 */

import { Notification } from 'electron';
import path from 'path';

export const playSound = (type: 'success' | 'error' | 'alert') => {
  // 실제 앱에서는 resources 폴더의 wav 파일을 로드하여 재생
  // const audio = new Audio(path.join(__dirname, `../../resources/sounds/${type}.wav`));
  // audio.play().catch(e => console.error('Failed to play sound', e));
  console.log(`[Sound] Playing ${type} sound`);
};

export const showNotification = (title: string, body: string, type: 'success' | 'error' | 'info' = 'info') => {
  const notification = new Notification({
    title,
    body,
    silent: true, // 사운드는 playSound에서 별도 제어
    icon: path.join(__dirname, '../../resources/icons/logo.png'), // 아이콘 경로 설정 필요
  });

  notification.show();

  if (type === 'success') playSound('success');
  if (type === 'error') playSound('error');
};
