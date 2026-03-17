/**
 * @file core/utils/notification.ts
 * @description 시스템 알림 및 Discord 웹훅 유틸리티
 */

import { Notification } from 'electron';
import axios from 'axios';
import { logger } from '../../utils/logger';

export async function sendSystemNotification(title: string, body: string) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

export async function sendDiscordWebhook(url: string, payload: any) {
  if (!url) return;
  try {
    await axios.post(url, payload);
  } catch (error: any) {
    logger.error('Notification: Discord Webhook failed', { error: error.message });
  }
}

export function formatSupremeSuccessEmbed(task: any) {
  return {
    embeds: [{
      title: '🚀 Supreme Success!',
      color: 0x00ffd0,
      fields: [
        { name: 'Product', value: task.url || 'Keywords Match', inline: true },
        { name: 'Size', value: task.size || 'Any', inline: true },
        { name: 'Profile', value: task.profileId, inline: true },
        { name: 'Order #', value: task.result?.orderNumber || 'N/A', inline: false }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Valor AIO • Supreme Module' }
    }]
  };
}
