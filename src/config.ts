import { config as dotenvConfig } from 'dotenv';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

dotenvConfig();

const DEFAULT_SESSION_DIR = join(homedir(), '.config', 'facebook-cli', 'sessions');

export const config = {
  facebook: {
    email: process.env.FACEBOOK_EMAIL || '',
    password: process.env.FACEBOOK_PASSWORD || '',
    sessionDir: process.env.FACEBOOK_SESSION_DIR || DEFAULT_SESSION_DIR,
    headless: process.env.FACEBOOK_HEADLESS !== 'false',
    slowMo: parseInt(process.env.FACEBOOK_SLOW_MO || '0', 10),
  },
  runtime: {
    headless: true, // Will be overridden by --headed flag
  },
  browser: {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    timeout: 30000,
  },
  delays: {
    min: 1000,
    max: 5000,
  },
};

export function ensureSessionDir(): void {
  if (!existsSync(config.facebook.sessionDir)) {
    mkdirSync(config.facebook.sessionDir, { recursive: true });
  }
}

export function getSessionPath(): string {
  return join(config.facebook.sessionDir, 'cookies.json');
}

export function validateConfig(): void {
  if (!config.facebook.email || !config.facebook.password) {
    throw new Error('FACEBOOK_EMAIL and FACEBOOK_PASSWORD must be set in .env file');
  }
}
