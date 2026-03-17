import { SensorGenerator } from '../../utils/tls-client';
import { logger } from '../../utils/logger';
import { Capsolver } from '../../src/main/utils/captcha/capsolver';

export interface CheckoutContext {
  variantId: string;
  email: string;
  paymentMethod: 'card' | 'paypal';
  checkoutMode: 'auto' | 'assist' | 'browser';
  shipping: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    zipCode: string;
    country: string;
    province: string;
    phone: string;
  };
  payment: {
    cardNumber: string;
    cardHolder: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
  };
}

export interface CheckoutResult {
  status: 'success' | 'processing' | 'failed';
  checkoutUrl: string;
  orderNumber: string;
  total: number;
  verificationUrl?: string;
  stage?: 'completed' | 'processing' | 'paypal_redirect' | 'browser_handoff' | 'awaiting_action';
}

type PreparedCheckout = {
  html: string;
  authToken: string;
  captchaToken: string;
  total: number;
};

type CaptchaChallenge = {
  type: 'recaptcha' | 'hcaptcha' | 'turnstile';
  siteKey: string;
  action?: string;
  invisible?: boolean;
};

export class ShopifyTask {
  private client: any;
  private solver: Capsolver | null = null;
  private storeUrl: string;
  private checkoutUrl: string = '';
  private onDebugLog?: (message: string) => void;

  constructor(options: { storeUrl: string; client: any; captchaApiKey?: string; onDebugLog?: (message: string) => void }) {
    this.storeUrl = options.storeUrl;
    this.client = options.client;
    this.onDebugLog = options.onDebugLog;
    if (options.captchaApiKey) {
      this.solver = new Capsolver({ apiKey: options.captchaApiKey });
    }
  }

  /**
   * ATC (Add to Cart) with enhanced headers
   */
  async addToCart(variantId: string, quantity: number = 1) {
    this.debug(`ATC warmup for variant ${variantId}`);
    
    // Cookie initialization
    await this.client.get(`${this.storeUrl}/products/all`, {
      followRedirects: true
    });

    const resp = await this.client.post(`${this.storeUrl}/cart/add.js`, {
      body: JSON.stringify({ id: variantId, quantity }),
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': this.storeUrl
      },
      followRedirects: true
    });

    if (resp.status !== 200) {
      throw this.stageError('ATC', `Cart add failed with HTTP ${resp.status}`);
    }
    
    return typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
  }

  /**
   * Complete multi-step checkout flow
   */
  async fullCheckout(ctx: CheckoutContext): Promise<CheckoutResult> {
    const prepared = await this.prepareCheckout(ctx);

    if (ctx.checkoutMode === 'browser') {
      return {
        status: 'processing',
        checkoutUrl: this.checkoutUrl,
        verificationUrl: this.checkoutUrl,
        orderNumber: '',
        total: prepared.total,
        stage: 'browser_handoff',
      };
    }

    const gateway = this.resolvePaymentGateway(prepared.html, ctx.paymentMethod);
    if (!gateway) {
      throw new Error(`No ${ctx.paymentMethod} payment gateway found on checkout page`);
    }

    if (ctx.paymentMethod === 'paypal') {
      return this.submitPayPal(gateway, prepared.authToken, prepared.captchaToken);
    }

    return this.submitCardPayment(ctx, gateway, prepared.authToken, prepared.captchaToken);
  }

  private async prepareCheckout(ctx: CheckoutContext): Promise<PreparedCheckout> {
    // 1. Get initial checkout session
    this.debug('Resolving checkout URL');
    let resp = await this.client.get(`${this.storeUrl}/checkout`, {
      followRedirects: false
    });
    
    this.checkoutUrl = resp.headers.location || resp.url;
    if (!this.checkoutUrl.includes('http')) {
       this.checkoutUrl = new URL(this.checkoutUrl, this.storeUrl).toString();
    }
    this.updateCheckoutUrl(this.checkoutUrl);

    // 2. Submit Contact Information
    this.debug('Submitting contact_information step');
    resp = await this.client.get(this.checkoutUrl, { followRedirects: true });
    this.updateCheckoutUrl(resp.url);
    let html = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body);
    let authToken = this.extractToken(html);
    if (!authToken) {
      throw this.stageError('CONTACT', 'Missing authenticity token on contact step');
    }

    const shippingPayload = {
      _method: 'patch',
      authenticity_token: authToken,
      previous_step: 'contact_information',
      step: 'shipping_method',
      'checkout[email]': ctx.email,
      'checkout[shipping_address][first_name]': ctx.shipping.firstName,
      'checkout[shipping_address][last_name]': ctx.shipping.lastName,
      'checkout[shipping_address][address1]': ctx.shipping.address,
      'checkout[shipping_address][city]': ctx.shipping.city,
      'checkout[shipping_address][zip]': ctx.shipping.zipCode,
      'checkout[shipping_address][country]': ctx.shipping.country,
      'checkout[shipping_address][province]': ctx.shipping.province,
      'checkout[shipping_address][phone]': ctx.shipping.phone,
      'checkout[client_details][browser_width]': 1920,
      'checkout[client_details][browser_height]': 1080,
      's': SensorGenerator.generateAkamaiSensor(this.storeUrl)
    };

    resp = await this.client.post(this.checkoutUrl, {
      body: new URLSearchParams(shippingPayload as any).toString(),
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': this.storeUrl,
        'Referer': this.checkoutUrl
      },
      followRedirects: true
    });
    this.updateCheckoutUrl(resp.url);

    // 3. Select Shipping Method
    this.debug('Selecting shipping method');
    html = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body);
    authToken = this.extractToken(html);
    if (!authToken) {
      throw this.stageError('SHIPPING', 'Missing authenticity token on shipping step');
    }
    const rateId = this.extractShippingRate(html);
    if (!rateId) {
      throw this.stageError('SHIPPING', 'No shipping rate could be extracted from checkout page');
    }

    const methodPayload = {
      _method: 'patch',
      authenticity_token: authToken,
      previous_step: 'shipping_method',
      step: 'payment_method',
      'checkout[shipping_rate][id]': rateId
    };

    resp = await this.client.post(this.checkoutUrl, {
      body: new URLSearchParams(methodPayload as any).toString(),
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': this.storeUrl,
        'Referer': this.checkoutUrl
       },
      followRedirects: true
    });
    this.updateCheckoutUrl(resp.url);

    // 4. Payment Preparation
    this.debug('Preparing payment step');
    html = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body);
    authToken = this.extractToken(html);
    if (!authToken) {
      throw this.stageError('PAYMENT_PREP', 'Missing authenticity token on payment step');
    }

    const captchaToken = await this.solveCaptchaIfPresent(html, this.checkoutUrl, 'PAYMENT_PREP');

    return {
      html,
      authToken,
      captchaToken,
      total: this.extractTotal(html) || 0,
    };
  }

  private async submitCardPayment(
    ctx: CheckoutContext,
    gateway: string,
    authToken: string,
    captchaToken: string,
  ): Promise<CheckoutResult> {
    let { resp, html } = await this.submitCheckoutForm(
      this.buildCardPaymentPayload(ctx, gateway, authToken, captchaToken),
    );

    const paymentCaptchaToken = await this.solveCaptchaIfPresent(html, resp.url || this.checkoutUrl, 'PAYMENT_SUBMIT');
    if (paymentCaptchaToken) {
      const refreshedToken = this.extractToken(html) || authToken;
      ({ resp, html } = await this.submitCheckoutForm(
        this.buildCardPaymentPayload(ctx, gateway, refreshedToken, paymentCaptchaToken),
      ));
    }

    if (resp.url.includes('thank_you') || resp.url.includes('orders') || html.includes('confirm_order') || html.includes('order_number')) {
        const orderNumber = this.extractOrderNumber(html);
        return {
            status: 'success',
            checkoutUrl: resp.url,
            orderNumber,
            total: this.extractTotal(html) || 0,
            stage: 'completed',
        };
    }

    if (resp.url.includes('processing') || html.includes('processing')) {
       return {
         status: 'processing',
         checkoutUrl: resp.url,
         orderNumber: '',
         total: 0,
         stage: ctx.checkoutMode === 'assist' ? 'awaiting_action' : 'processing',
       };
    }

    if (this.requiresManualAction(html, resp.url)) {
      return {
        status: 'processing',
        checkoutUrl: resp.url,
        orderNumber: '',
        total: this.extractTotal(html) || 0,
        stage: ctx.checkoutMode === 'assist' ? 'awaiting_action' : 'processing',
      };
    }

    // If still on checkout after payment step, it might be an error
    if (this.hasCheckoutFailure(html)) {
        const errorMsg = this.extractErrorMessage(html) || 'Card rejected or payment failed';
        throw this.stageError('PAYMENT_SUBMIT', errorMsg);
    }

    return { 
      status: 'processing', 
      checkoutUrl: resp.url,
      orderNumber: '',
      total: 0,
      stage: ctx.checkoutMode === 'assist' ? 'awaiting_action' : 'processing',
    };
  }

  private buildCardPaymentPayload(
    ctx: CheckoutContext,
    gateway: string,
    authToken: string,
    captchaToken: string,
  ) {
    const paymentPayload: any = {
      _method: 'patch',
      authenticity_token: authToken,
      previous_step: 'payment_method',
      step: '',
      's': SensorGenerator.generateAkamaiSensor(this.storeUrl),
      'checkout[payment_gateway]': gateway,
      'checkout[credit_card][number]': ctx.payment.cardNumber,
      'checkout[credit_card][name]': ctx.payment.cardHolder,
      'checkout[credit_card][month]': parseInt(ctx.payment.expiryMonth),
      'checkout[credit_card][year]': parseInt(ctx.payment.expiryYear),
      'checkout[credit_card][verification_value]': ctx.payment.cvv,
    };

    if (captchaToken) {
      paymentPayload['g-recaptcha-response'] = captchaToken;
      paymentPayload['h-captcha-response'] = captchaToken;
      paymentPayload['cf-turnstile-response'] = captchaToken;
    }

    return paymentPayload;
  }

  async checkCheckoutStatus(checkoutUrl: string): Promise<CheckoutResult> {
    this.debug(`Re-checking checkout status at ${checkoutUrl}`);

    const resp = await this.client.get(checkoutUrl, {
      followRedirects: true,
      headers: {
        Origin: this.storeUrl,
        Referer: checkoutUrl,
      },
    });

    const html = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body);

    if (
      resp.url.includes('thank_you') ||
      resp.url.includes('orders') ||
      html.includes('confirm_order') ||
      html.includes('order_number')
    ) {
      return {
        status: 'success',
        checkoutUrl: resp.url,
        orderNumber: this.extractOrderNumber(html),
        total: this.extractTotal(html) || 0,
        stage: 'completed',
      };
    }

    if (this.hasCheckoutFailure(html)) {
      const errorMsg = this.extractErrorMessage(html) || 'Checkout failed during status re-check';
      throw this.stageError('STATUS_RECHECK', errorMsg);
    }

    return {
      status: 'processing',
      checkoutUrl: resp.url,
      orderNumber: '',
      total: 0,
      stage: this.requiresManualAction(html, resp.url) ? 'awaiting_action' : 'processing',
    };
  }

  async submitPayPal(gateway: string, authToken: string, captchaToken?: string): Promise<CheckoutResult> {
    this.debug(`Submitting PayPal redirect using gateway ${gateway}`);
    const payload: any = {
      _method: 'patch',
      authenticity_token: authToken,
      previous_step: 'payment_method',
      step: '',
      'checkout[payment_gateway]': gateway,
    };
    if (captchaToken) {
      payload['g-recaptcha-response'] = captchaToken;
    }

    const resp = await this.client.post(this.checkoutUrl, {
      body: new URLSearchParams(payload).toString(),
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': this.storeUrl,
        'Referer': this.checkoutUrl
      },
      followRedirects: false // We expect a redirect to paypal.com
    });
    this.updateCheckoutUrl(resp.url);

    const redirectUrl = resp.headers.location || resp.url;
    if (redirectUrl.includes('paypal.com')) {
      return {
        status: 'processing',
        checkoutUrl: redirectUrl,
        orderNumber: '',
        total: 0,
        verificationUrl: this.checkoutUrl,
        stage: 'paypal_redirect',
      };
    }

    const html = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body);
    const challengeToken = await this.solveCaptchaIfPresent(html, resp.url || this.checkoutUrl, 'PAYPAL_REDIRECT');
    if (challengeToken) {
      const retryToken = this.extractToken(html) || authToken;
      const retryResp = await this.client.post(this.checkoutUrl, {
        body: new URLSearchParams({
          _method: 'patch',
          authenticity_token: retryToken,
          previous_step: 'payment_method',
          step: '',
          'checkout[payment_gateway]': gateway,
          'g-recaptcha-response': challengeToken,
          'h-captcha-response': challengeToken,
          'cf-turnstile-response': challengeToken,
        } as any).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': this.storeUrl,
          'Referer': this.checkoutUrl
        },
        followRedirects: false
      });

      const retryRedirect = retryResp.headers.location || retryResp.url;
      if (retryRedirect.includes('paypal.com')) {
        return {
          status: 'processing',
          checkoutUrl: retryRedirect,
          orderNumber: '',
          total: 0,
          verificationUrl: this.checkoutUrl,
          stage: 'paypal_redirect',
        };
      }
    }

    throw this.stageError('PAYPAL_REDIRECT', 'No PayPal redirect URL found after payment submit');
  }

  async solveAndInjectCaptcha(
    siteKey: string,
    siteUrl: string,
    type: 'recaptcha' | 'hcaptcha' | 'turnstile' = 'recaptcha',
    action: string = 'checkout',
  ) {
    if (!this.solver) throw new Error('Captcha solver configuration missing');
    
    this.debug(`Solving ${type} challenge for ${siteUrl}`);
    const result = await (type === 'hcaptcha' ? this.solver.solveHCaptcha(siteKey, siteUrl) : 
                        type === 'turnstile' ? this.solver.solveTurnstile(siteKey, siteUrl) : 
                        this.solver.solveReCaptchaV3(siteKey, siteUrl, action));
    
    // Since we can't use setOptions, we'll return the token to be used in the next request body or headers if possible
    // In Shopify, it's usually g-recaptcha-response in the payload
    return result.token;
  }

  private extractToken(html: string): string {
    const match =
      html.match(/name="authenticity_token" value="(.+?)"/) ||
      html.match(/value="(.+?)"[^>]*name="authenticity_token"/) ||
      html.match(/authenticity_token.+?value="(.+?)"/);
    return match ? match[1] : '';
  }

  private extractShippingRate(html: string): string | null {
    const match =
      html.match(/radio" name="checkout\[shipping_rate\]\[id\]" value="(.+?)"/) ||
      html.match(/name="checkout\[shipping_rate\]\[id\]"[^>]+value="(.+?)"/) ||
      html.match(/value="(.+?)"[^>]+name="checkout\[shipping_rate\]\[id\]"/);
    return match ? match[1] : null;
  }

  private extractSiteKey(html: string): string {
    const match =
      html.match(/sitekey["']?\s*[:=]\s*["'](.+?)["']/i) ||
      html.match(/data-sitekey=["'](.+?)["']/i) ||
      html.match(/websiteKey["']?\s*[:=]\s*["'](.+?)["']/i);
    return match ? match[1] : '';
  }

  private extractOrderNumber(html: string): string {
    const match = 
      html.match(/order_number:\s*"(.+?)"/) || 
      html.match(/Order #(\d+)/) || 
      html.match(/order-number">(.+?)</) ||
      html.match(/order[\s_-]?number[^<]*<[^>]*>\s*([^<\s][^<]*)</i);
       
    return match ? match[1] : '';
  }

  private resolvePaymentGateway(html: string, preferredMethod: 'card' | 'paypal'): string {
    const gateways = this.extractPaymentGateways(html);
    if (gateways.length === 0) {
      return '';
    }

    if (preferredMethod === 'paypal') {
      return gateways.find((gateway) => gateway.isPayPal)?.value ?? '';
    }

    return gateways.find((gateway) => !gateway.isPayPal)?.value ?? gateways[0].value;
  }

  private extractPaymentGateways(html: string): Array<{ value: string; isPayPal: boolean }> {
    const gateways: Array<{ value: string; isPayPal: boolean }> = [];
    const regex = /<input[^>]+name="checkout\[payment_gateway\]"[^>]+value="([^"]+)"[^>]*>/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null) {
      const value = match[1];
      const contextWindow = html.slice(
        Math.max(0, match.index - 200),
        Math.min(html.length, match.index + match[0].length + 400),
      );
      const normalizedContext = contextWindow.toLowerCase();
      const normalizedValue = value.toLowerCase();

      gateways.push({
        value,
        isPayPal:
          normalizedValue.includes('paypal') ||
          normalizedContext.includes('paypal') ||
          normalizedContext.includes('data-payment-subform="paypal"') ||
          normalizedContext.includes("data-payment-subform='paypal'"),
      });
    }

    if (gateways.length > 0) {
      return gateways;
    }

    const fallbackValue = this.extractGatewayFallback(html);
    return fallbackValue ? [{ value: fallbackValue, isPayPal: fallbackValue.toLowerCase().includes('paypal') }] : [];
  }

  private extractGatewayFallback(html: string): string {
    const match = html.match(/name="checkout\[payment_gateway\]" value="(.+?)"/);
    return match ? match[1] : '';
  }

  private extractTotal(html: string): number {
    const match = html.match(/payment-due__price">(.+?)</);
    if (!match) return 0;
    return parseFloat(match[1].replace(/[^\d.]/g, ''));
  }

  private extractErrorMessage(html: string): string | null {
    const match =
      html.match(/notice__content">(.+?)</) ||
      html.match(/field__error-message">(.+?)</) ||
      html.match(/role="alert"[^>]*>\s*([^<]+)\s*</) ||
      html.match(/data-step-error="([^"]+)"/);
    return match ? this.decodeHtml(match[1].trim()) : null;
  }

  private requiresManualAction(html: string, url: string): boolean {
    const normalizedHtml = html.toLowerCase();
    const normalizedUrl = url.toLowerCase();
    return (
      normalizedUrl.includes('processing') ||
      normalizedUrl.includes('authenticate') ||
      normalizedUrl.includes('challenge') ||
      normalizedHtml.includes('3d secure') ||
      normalizedHtml.includes('3d_secure') ||
      normalizedHtml.includes('three_d_secure') ||
      normalizedHtml.includes('challenge') ||
      normalizedHtml.includes('additional action') ||
      normalizedHtml.includes('verify your identity')
    );
  }

  private async submitCheckoutForm(payload: Record<string, unknown>) {
    const resp = await this.client.post(this.checkoutUrl, {
      body: new URLSearchParams(payload as any).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': this.storeUrl,
        'Referer': this.checkoutUrl,
      },
      followRedirects: true,
    });

    this.updateCheckoutUrl(resp.url);
    const html = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body);
    return { resp, html };
  }

  private async solveCaptchaIfPresent(html: string, pageUrl: string, stage: string) {
    const challenge = this.detectCaptchaChallenge(html);
    if (!challenge) {
      return '';
    }

    if (!this.solver) {
      throw this.stageError(stage, `Captcha detected (${challenge.type}) but solver key is not configured`);
    }

    if (!challenge.siteKey) {
      throw this.stageError(stage, `Captcha detected (${challenge.type}) but sitekey could not be extracted`);
    }

    this.debug(
      `ShopifyTask: ${stage} captcha detected (${challenge.type}) on ${pageUrl}. Starting solver...`,
    );
    const startedAt = Date.now();
    const token = await this.solveAndInjectCaptcha(
      challenge.siteKey,
      pageUrl,
      challenge.type,
      challenge.action ?? 'checkout',
    );
    this.debug(
      `ShopifyTask: ${stage} captcha solved in ${Date.now() - startedAt}ms (${challenge.type})`,
    );
    return token;
  }

  private detectCaptchaChallenge(html: string): CaptchaChallenge | null {
    const normalizedHtml = html.toLowerCase();
    const siteKey = this.extractSiteKey(html);
    const actionMatch = html.match(/grecaptcha\.execute\([^,]+,\s*\{\s*action:\s*['"](.+?)['"]/i);

    if (
      normalizedHtml.includes('cf-turnstile') ||
      normalizedHtml.includes('turnstile') ||
      normalizedHtml.includes('challenges.cloudflare.com')
    ) {
      return {
        type: 'turnstile',
        siteKey,
      };
    }

    if (normalizedHtml.includes('h-captcha') || normalizedHtml.includes('hcaptcha.com')) {
      return {
        type: 'hcaptcha',
        siteKey,
        invisible: normalizedHtml.includes('data-size="invisible"'),
      };
    }

    if (
      normalizedHtml.includes('g-recaptcha') ||
      normalizedHtml.includes('grecaptcha') ||
      normalizedHtml.includes('recaptcha')
    ) {
      return {
        type: 'recaptcha',
        siteKey,
        action: actionMatch?.[1] ?? 'checkout',
      };
    }

    return null;
  }

  private hasCheckoutFailure(html: string) {
    const normalizedHtml = html.toLowerCase();
    return (
      normalizedHtml.includes('notice__content') ||
      normalizedHtml.includes('field__error-message') ||
      normalizedHtml.includes('card was declined') ||
      normalizedHtml.includes('payment could not be processed') ||
      normalizedHtml.includes('invalid credit card') ||
      normalizedHtml.includes('declined')
    );
  }

  private decodeHtml(value: string) {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  private stageError(stage: string, message: string) {
    return new Error(`[${stage}] ${message}`);
  }

  private updateCheckoutUrl(url?: string) {
    if (url && url.includes('/checkouts/')) {
      this.checkoutUrl = url;
    }
  }

  private debug(message: string) {
    logger.info(`ShopifyTask: ${message}`);
    this.onDebugLog?.(`[SHOPIFY] ${message}`);
  }
}
