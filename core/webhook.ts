/**
 * @file core/webhook.ts
 * @description Discord 웹훅을 통해 알림을 전송하는 유틸리티입니다.
 */

import { logger } from '../utils/logger';
import { configManager } from './config';

interface WebhookPayload {
  content?: string;
  embeds?: Array<{
    title?: string;
    description?: string;
    color?: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    footer?: { text: string };
    thumbnail?: { url: string };
  }>;
}

export const sendWebhook = async (payload: WebhookPayload) => {
  const webhookUrl = configManager.get('webhookUrl');
  
  if (!webhookUrl) {
    logger.debug('Webhook URL not configured, skipping notification.');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord returned ${response.status}`);
    }

    logger.debug('Webhook sent successfully.');
  } catch (error: any) {
    logger.error('Failed to send webhook', { error: error.message });
  }
};
