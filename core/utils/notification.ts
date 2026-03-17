import { Notification } from 'electron';
import axios from 'axios';
import { logger } from '../../utils/logger';

export async function sendSystemNotification(title: string, body: string) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

export async function sendDiscordWebhook(url: string, payload: unknown) {
  if (!url) {
    return;
  }

  try {
    await axios.post(url, payload, {
      timeout: 15_000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    logger.error('Notification: Discord Webhook failed', { error: error.message });
    throw error;
  }
}

export function formatSupremeSuccessEmbed(task: any) {
  return {
    embeds: [
      {
        title: 'Supreme Success',
        color: 0x00ffd0,
        fields: [
          { name: 'Product', value: task.url || 'Keywords Match', inline: true },
          { name: 'Size', value: task.size || 'Any', inline: true },
          { name: 'Profile', value: task.profileId || 'Unknown', inline: true },
          { name: 'Order #', value: task.result?.orderNumber || 'N/A', inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Antigravity Supreme Module' },
      },
    ],
  };
}

export function formatSupremeFailureEmbed(task: any) {
  return {
    embeds: [
      {
        title: 'Supreme Failure',
        color: 0xff4d67,
        fields: [
          { name: 'Product', value: task.url || 'Keywords Match', inline: true },
          { name: 'Mode', value: task.mode || 'Unknown', inline: true },
          { name: 'Profile', value: task.profileId || 'Unknown', inline: true },
          {
            name: 'Error',
            value: task.lastError || task.logs?.[0] || 'Unknown failure',
            inline: false,
          },
          {
            name: 'Stage',
            value: task.result?.lastStage || task.status || 'failed',
            inline: true,
          },
          {
            name: 'Retries',
            value: String(task.retryCount ?? 0),
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Antigravity Supreme Module' },
      },
    ],
  };
}
