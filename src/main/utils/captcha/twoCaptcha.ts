import axios from 'axios';
import { CaptchaSolver, CaptchaResult, SolverOptions } from './types';
import { logger } from '../../../../utils/logger';

export class TwoCaptcha implements CaptchaSolver {
  private apiKey: string;
  private baseUrl = 'https://2captcha.com';

  constructor(options: SolverOptions) {
    this.apiKey = options.apiKey;
  }

  async solveHCaptcha(siteKey: string, url: string, invisible: boolean = false): Promise<CaptchaResult> {
    try {
      const response = await axios.get(`${this.baseUrl}/in.php`, {
        params: {
          key: this.apiKey,
          method: 'hcaptcha',
          sitekey: siteKey,
          pageurl: url,
          invisible: invisible ? 1 : 0,
          json: 1
        }
      });

      if (response.data.status === 1) {
        return this.pollResult(response.data.request);
      }
      throw new Error(`2Captcha error: ${response.data.request}`);
    } catch (error) {
      logger.error('2Captcha HCaptcha Task Error', error);
      throw error;
    }
  }

  async solveReCaptchaV3(siteKey: string, url: string, action: string): Promise<CaptchaResult> {
    try {
      const response = await axios.get(`${this.baseUrl}/in.php`, {
        params: {
          key: this.apiKey,
          method: 'userrecaptcha',
          googlekey: siteKey,
          pageurl: url,
          version: 'v3',
          action: action,
          min_score: 0.3,
          json: 1
        }
      });

      if (response.data.status === 1) {
        return this.pollResult(response.data.request);
      }
      throw new Error(`2Captcha error: ${response.data.request}`);
    } catch (error) {
      logger.error('2Captcha ReCaptchaV3 Task Error', error);
      throw error;
    }
  }

  async solveTurnstile(siteKey: string, url: string): Promise<CaptchaResult> {
    try {
      const response = await axios.get(`${this.baseUrl}/in.php`, {
        params: {
          key: this.apiKey,
          method: 'turnstile',
          sitekey: siteKey,
          pageurl: url,
          json: 1
        }
      });

      if (response.data.status === 1) {
        return this.pollResult(response.data.request);
      }
      throw new Error(`2Captcha error: ${response.data.request}`);
    } catch (error) {
      logger.error('2Captcha Turnstile Task Error', error);
      throw error;
    }
  }

  private async pollResult(id: string): Promise<CaptchaResult> {
    const maxRetries = 60;
    for (let i = 0; i < maxRetries; i++) {
      const response = await axios.get(`${this.baseUrl}/res.php`, {
        params: {
          key: this.apiKey,
          action: 'get',
          id: id,
          json: 1
        }
      });

      if (response.data.status === 1) {
        return {
          token: response.data.request
        };
      }

      if (response.data.request !== 'CAPCHA_NOT_READY') {
        throw new Error(`2Captcha task failed: ${response.data.request}`);
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error('2Captcha timeout');
  }
}
