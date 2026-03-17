export interface CaptchaResult {
  token: string;
  userAgent?: string;
}

export interface CaptchaSolver {
  solveHCaptcha(siteKey: string, url: string, invisible?: boolean): Promise<CaptchaResult>;
  solveReCaptchaV3(siteKey: string, url: string, action: string): Promise<CaptchaResult>;
  solveTurnstile(siteKey: string, url: string): Promise<CaptchaResult>;
}

export interface SolverOptions {
  apiKey: string;
}
