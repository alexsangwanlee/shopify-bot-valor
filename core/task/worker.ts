import { parentPort } from 'worker_threads';
import type { ResolvedBillingProfile } from '../app-data';
import { SupremeTask, TaskId } from './types';
import { createHttpClient, initializeTLS } from '../../utils/tls-client';
import {
  extractListingSignals,
  findBestMonitorMatch,
  getCachedMonitorProducts,
  getStaleCachedMonitorProducts,
  resolveMonitorConfig,
  setCachedMonitorProducts,
} from './monitoring';
import { ShopifyTask } from './shopify';

type WorkerMessageType = 'log' | 'status' | 'success' | 'error' | 'processing';

type WorkerInput = {
  taskId: TaskId;
  task: SupremeTask;
  proxyUrl?: string;
  fingerprint?: any;
  profile?: ResolvedBillingProfile;
};

let currentTaskId: TaskId;

function sendToMain(type: WorkerMessageType, payload: unknown) {
  parentPort?.postMessage({
    type,
    taskId: currentTaskId,
    payload,
    timestamp: Date.now(),
  });
}

function log(message: string) {
  sendToMain('log', message);
}

function updateStatus(status: string) {
  sendToMain('status', status);
}

function resolveProcessingStage(
  task: SupremeTask,
  checkoutUrl?: string,
  stage?: string,
) {
  if (stage) {
    return stage;
  }

  if (checkoutUrl?.includes('paypal.com')) {
    return 'paypal_redirect';
  }

  if (task.checkoutMode === 'browser') {
    return 'browser_handoff';
  }

  if (task.checkoutMode === 'assist') {
    return 'awaiting_action';
  }

  return 'processing';
}

function formatProcessingLog(stage: string, orderNumber?: string) {
  if (stage === 'paypal_redirect') {
    return 'PayPal redirect ready';
  }

  if (stage === 'browser_handoff') {
    return 'Browser checkout handoff ready';
  }

  if (stage === 'awaiting_action') {
    return orderNumber || 'Awaiting manual verification';
  }

  return orderNumber || 'Awaiting confirmation';
}

let isTLSInitialized = false;

async function ensureTLS() {
  if (!isTLSInitialized) {
    await initializeTLS();
    isTLSInitialized = true;
  }
}

async function runCheckoutFlow(data: WorkerInput) {
  await ensureTLS();
  const { task, proxyUrl, fingerprint, profile } = data;
  updateStatus('running');
  log(`[SHOPIFY] Starting automation for ${task.url}`);

  if (!profile) {
    throw new Error('No checkout profile assigned to task');
  }

  const client = createHttpClient({
    fingerprint: fingerprint || {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
      ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513-21,29-23-24,0',
      http2: '1:65536;2:0;3:100;4:2097152;6:65536'
    },
    proxy: proxyUrl,
    timeout: 15000
  });

  try {
    const fullUrl = task.url || '';
    let storeUrl: string;
    try {
      storeUrl = fullUrl.startsWith('http') ? new URL(fullUrl).origin : `https://${fullUrl.split('/')[0]}`;
    } catch (e) {
      throw new Error(`Invalid task URL: ${fullUrl}`);
    }

    const shopify = new ShopifyTask({
      storeUrl,
      client,
      captchaApiKey: profile.captchaApiKey || (task as any).captchaApiKey,
      onDebugLog: log,
    });

    const urlVariantId = task.url?.includes('/variants/') ? task.url.split('/').pop() : undefined;
    const variantId = urlVariantId || task.result?.variantId || '';
    
    if (!variantId || variantId === 'all') {
      throw new Error('No specific variant selected for checkout');
    }

    log(`[ATC] Attempting cart add for variant ${variantId}`);
    await shopify.addToCart(variantId); 
    log('[ATC] Cart request prepared'); 
    
    log('[CHECKOUT] Initiating checkout flow with telemetry and captcha support...');
    
    const resolvedCard = task.creditCard ?? profile.secureCard;

    if (task.paymentMethod === 'card' && task.checkoutMode !== 'browser' && !resolvedCard) {
        throw new Error('Credit card details missing for card payment mode');
    }

    const result = await shopify.fullCheckout({
      variantId,
      email: profile.email,
      paymentMethod: task.paymentMethod,
      checkoutMode: task.checkoutMode,
      shipping: {
        firstName: profile.name?.split(' ')[0] || '',
        lastName: profile.name?.split(' ')[1] || '',
        address: profile.address1 || '',
        city: profile.city || '',
        zipCode: profile.zip || '',
        country: profile.country || 'United States',
        province: profile.province || '',
        phone: profile.phone || ''
      },
      payment: task.paymentMethod === 'card' && resolvedCard ? {
        cardNumber: resolvedCard.cardNumber,
        cardHolder: resolvedCard.cardHolder,
        expiryMonth: resolvedCard.expiryMonth,
        expiryYear: resolvedCard.expiryYear,
        cvv: resolvedCard.cvv
      } : {
        cardNumber: '',
        cardHolder: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: ''
      }
      });
    
    if (result.status === 'success') {
      log(`[CHECKOUT] Success. Order: ${result.orderNumber}`);
      sendToMain('success', {
        orderNumber: result.orderNumber,
        total: result.total || 0,
        lastStage: 'completed',
        variantId
      });
      return { success: true, orderNumber: result.orderNumber };
    } else if (result.status === 'processing') {
      const lastStage = resolveProcessingStage(task, result.checkoutUrl, result.stage);
      log(`[CHECKOUT] Processing: ${formatProcessingLog(lastStage, result.orderNumber)}`);
      updateStatus('processing');
      sendToMain('processing', {
        lastStage,
        orderNumber: result.orderNumber,
        variantId,
        checkoutUrl: result.checkoutUrl,
        verificationUrl: result.verificationUrl,
      });
      return { success: true, pending: true };
    } else {
      throw new Error(`Unexpected checkout status: ${result.status}`);
    }
  } catch (error: any) {
    log(`[CHECKOUT] Failure: ${error.message}`);
    throw error;
  } finally {
    // Crucial: Close the HTTP session to prevent leaks
    try {
      await client.close();
      log('HTTP session closed');
    } catch (e) {
      log('Failed to close HTTP session cleanly');
    }
  }
}

async function runProcessingCheck(data: WorkerInput) {
  await ensureTLS();
  const { task, proxyUrl, fingerprint, profile } = data;
  updateStatus('processing');
  log(`[CHECKOUT] Re-checking processing checkout for ${task.url}`);

  const client = createHttpClient({
    fingerprint: fingerprint || {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
      ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513-21,29-23-24,0',
      http2: '1:65536;2:0;3:100;4:2097152;6:65536'
    },
    proxy: proxyUrl,
    timeout: 15000
  });

  try {
    const checkoutUrl = task.result?.verificationUrl || task.result?.checkoutUrl;
    if (!checkoutUrl) {
      throw new Error('Missing checkout URL for processing re-check');
    }

    const fullUrl = task.url || '';
    const storeUrl = fullUrl.startsWith('http') ? new URL(fullUrl).origin : `https://${fullUrl.split('/')[0]}`;
    const shopify = new ShopifyTask({
      storeUrl,
      client,
      captchaApiKey: profile?.captchaApiKey || (task as any).captchaApiKey,
      onDebugLog: log,
    });

    const result = await shopify.checkCheckoutStatus(checkoutUrl);
    const variantId = task.result?.variantId || '';

    if (result.status === 'success') {
      log(`[CHECKOUT] Success after re-check. Order: ${result.orderNumber || 'confirmed'}`);
      sendToMain('success', {
        orderNumber: result.orderNumber,
        total: result.total || 0,
        lastStage: 'completed',
        variantId,
        checkoutUrl: result.checkoutUrl,
      });
      return { success: true, orderNumber: result.orderNumber };
    }

    const lastStage = resolveProcessingStage(task, result.checkoutUrl, result.stage);
    log(`[CHECKOUT] Still processing: ${formatProcessingLog(lastStage, result.orderNumber)}`);
    sendToMain('processing', {
      lastStage,
      orderNumber: '',
      variantId,
      checkoutUrl: result.checkoutUrl,
      verificationUrl: result.verificationUrl || checkoutUrl,
    });
    return { success: true, pending: true };
  } catch (error: any) {
    log(`[CHECKOUT] Processing re-check failure: ${error.message}`);
    throw error;
  } finally {
    try {
      await client.close();
      log('HTTP session closed');
    } catch (e) {
      log('Failed to close HTTP session cleanly');
    }
  }
}

async function runMonitorFlow(data: WorkerInput) {
  await ensureTLS();
  const { task, proxyUrl, fingerprint } = data;
  updateStatus('monitoring');
  const monitorConfig = resolveMonitorConfig(task.url, task.mode === 'monitor' ? task.monitorCategory : undefined);
  log(
    `[MONITOR] Checking listing ${monitorConfig.listingPath} for ${task.keywords?.join(', ') || 'keywords'}...`,
  );

  const client = createHttpClient({
    fingerprint: fingerprint || {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
      ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513-21,29-23-24,0',
      http2: '1:65536;2:0;3:100;4:2097152;6:65536'
    },
    proxy: proxyUrl,
    timeout: 10000
  });

  try {
    const cachedProducts = getCachedMonitorProducts(monitorConfig.productsJsonUrl);
    const staleCachedProducts = getStaleCachedMonitorProducts(monitorConfig.productsJsonUrl);
    const [listingResp, productsResp] = await Promise.all([
      client.get(monitorConfig.listingUrl, {
        followRedirects: true,
      }),
      cachedProducts
        ? Promise.resolve(null)
        : client.get(monitorConfig.productsJsonUrl, {
            followRedirects: true,
          }).catch((error: any) => {
            if (staleCachedProducts) {
              log(
                `[MONITOR] Feed refresh failed (${error.message}). Falling back to stale cache with ${staleCachedProducts.length} products.`,
              );
              return null;
            }
            throw error;
          }),
    ]);

    if (listingResp.status !== 200) {
      throw new Error(`Listing status ${listingResp.status}`);
    }

    if (productsResp && productsResp.status !== 200) {
      throw new Error(`Products feed status ${productsResp.status}`);
    }

    const listingHtml =
      typeof listingResp.body === 'string' ? listingResp.body : JSON.stringify(listingResp.body);
    const listingSignals = extractListingSignals(listingHtml);
    const payload =
      cachedProducts
        ? { products: cachedProducts }
        : !productsResp && staleCachedProducts
          ? { products: staleCachedProducts }
        : typeof productsResp?.body === 'string'
          ? JSON.parse(productsResp.body)
          : productsResp?.body;
    const products = Array.isArray(payload?.products) ? payload.products : [];
    if (!cachedProducts && productsResp) {
      setCachedMonitorProducts(monitorConfig.productsJsonUrl, products);
      log(`[MONITOR] Feed refreshed for ${monitorConfig.listingPath} (${products.length} products)`);
    } else {
      log(`[MONITOR] Using cached feed for ${monitorConfig.listingPath} (${products.length} products)`);
    }
    const keywords = task.keywords || [];

    const match = findBestMonitorMatch({
      products,
      keywords,
      listingSignals,
      origin: monitorConfig.origin,
      desiredCategory: task.mode === 'monitor' ? task.monitorCategory : undefined,
      desiredSize: task.size,
      desiredColor: task.color,
    });

    if (match) {
      log(
        `[MONITOR] MATCH FOUND: ${match.matchedTitle} in ${match.matchedCategory || monitorConfig.listingPath} (variant ${match.variantId}, score ${match.matchScore})`,
      );
      return {
        continueMonitoring: true, 
        monitorHitsDelta: 1,
        lastHeartbeatAt: Date.now(),
        matchFound: true,
        variantId: match.variantId,
        matchedTitle: match.matchedTitle,
        matchedHandle: match.matchedHandle,
        matchedUrl: match.matchedUrl,
        matchedCategory: match.matchedCategory,
        matchScore: match.matchScore,
      };
    }

    log(
      `[MONITOR] No category-qualified matches on ${monitorConfig.listingPath}. Feed size: ${products.length}`,
    );
    return {
      continueMonitoring: true,
      monitorHitsDelta: 0,
      lastHeartbeatAt: Date.now(),
      matchFound: false
    };

  } catch (error: any) {
    log(`[MONITOR] Error: ${error.message}`);
    throw error;
  }
}

export async function runTask(data: WorkerInput) {
  currentTaskId = data.taskId;

  try {
    if (data.task.mode === 'monitor') {
      return await runMonitorFlow(data);
    }

    if (data.task.status === 'processing' && data.task.result?.checkoutUrl) {
      return await runProcessingCheck(data);
    }

    return await runCheckoutFlow(data);
  } catch (error) {
    const taskError = error as Error;
    sendToMain('error', { message: taskError.message });
    throw taskError;
  }
}
