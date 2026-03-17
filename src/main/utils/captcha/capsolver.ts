import axios from 'axios';
import { CaptchaSolver, CaptchaResult, SolverOptions } from './types';
import { logger } from '../../../../utils/logger';

export class Capsolver implements CaptchaSolver {
  private apiKey: string;
  private baseUrl = 'https://api.capsolver.com';
  private http = axios.create({
    timeout: 20_000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  constructor(options: SolverOptions) {
    this.apiKey = options.apiKey;
  }

  async solveHCaptcha(siteKey: string, url: string, invisible: boolean = false): Promise<CaptchaResult> {
    try {
      const response = await this.http.post(`${this.baseUrl}/createTask`, {
        clientKey: this.apiKey,
        task: {
          type: 'HCaptchaTaskProxyLess',
          websiteURL: url,
          websiteKey: siteKey,
          isInvisible: invisible
        }
      });

      if (response.data.errorId === 0) {
        return this.pollResult(response.data.taskId);
      }
      throw new Error(`Capsolver createTask failed: ${response.data.errorDescription}`);
    } catch (error) {
      logger.error('Capsolver HCaptcha Task Error', error);
      throw error;
    }
  }

  async solveReCaptchaV3(siteKey: string, url: string, action: string): Promise<CaptchaResult> {
    try {
      const response = await this.http.post(`${this.baseUrl}/createTask`, {
        clientKey: this.apiKey,
        task: {
          type: 'ReCaptchaV3TaskProxyLess',
          websiteURL: url,
          websiteKey: siteKey,
          pageAction: action
        }
      });

      if (response.data.errorId === 0) {
        return this.pollResult(response.data.taskId);
      }
      throw new Error(`Capsolver createTask failed: ${response.data.errorDescription}`);
    } catch (error) {
      logger.error('Capsolver ReCaptchaV3 Task Error', error);
      throw error;
    }
  }

  async solveTurnstile(siteKey: string, url: string): Promise<CaptchaResult> {
    try {
      const response = await this.http.post(`${this.baseUrl}/createTask`, {
        clientKey: this.apiKey,
        task: {
          type: 'AntiTurnstileTaskProxyLess',
          websiteURL: url,
          websiteKey: siteKey
        }
      });

      if (response.data.errorId === 0) {
        return this.pollResult(response.data.taskId);
      }
      throw new Error(`Capsolver createTask failed: ${response.data.errorDescription}`);
    } catch (error) {
      logger.error('Capsolver Turnstile Task Error', error);
      throw error;
    }
  }

  private async pollResult(taskId: string): Promise<CaptchaResult> {
    const maxRetries = 50;
    for (let i = 0; i < maxRetries; i++) {
      const response = await this.http.post(`${this.baseUrl}/getTaskResult`, {
        clientKey: this.apiKey,
        taskId
      });

      if (response.data.status === 'ready') {
        return {
          token: response.data.solution.gRecaptchaResponse || response.data.solution.token
        };
      }

      if (response.data.status === 'failed') {
        throw new Error(`Capsolver task failed: ${response.data.errorDescription}`);
      }

      await new Promise(resolve => setTimeout(resolve, i < 5 ? 1200 : 1800));
    }
    throw new Error('Capsolver timeout while waiting for captcha token');
  }
}
