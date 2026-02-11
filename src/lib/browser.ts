import { chromium, type Browser, type Page, type Cookie } from 'playwright';
import { config, ensureSessionDir, getSessionPath } from '../config';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { randomDelay } from './utils';
import logger from './logger';

export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;

  setHeadless(headless: boolean): void {
    config.runtime.headless = headless;
  }

  async launch(): Promise<Page> {
    if (this.page) {
      return this.page;
    }

    this.browser = await chromium.launch({
      headless: config.runtime.headless,
      slowMo: config.facebook.slowMo,
    });

    const context = await this.browser.newContext({
      viewport: config.browser.viewport,
      userAgent: config.browser.userAgent,
    });

    this.page = await context.newPage();
    
    // Load cookies if they exist
    await this.loadCookies();
    
    return this.page;
  }

  async loadCookies(): Promise<void> {
    if (!this.page) return;
    
    const sessionPath = getSessionPath();
    if (existsSync(sessionPath)) {
      try {
        const cookiesData = readFileSync(sessionPath, 'utf-8');
        const cookies: Cookie[] = JSON.parse(cookiesData);
        await this.page.context().addCookies(cookies);
      } catch (error) {
        logger.error(error, 'Failed to load cookies');
      }
    }
  }

  async saveCookies(): Promise<void> {
    if (!this.page) return;
    
    ensureSessionDir();
    const sessionPath = getSessionPath();
    
    try {
      const cookies = await this.page.context().cookies();
      writeFileSync(sessionPath, JSON.stringify(cookies, null, 2));
    } catch (error) {
        logger.error(error, 'Failed to save cookies');
    }
  }

  async close(): Promise<void> {
    if (this.page) {
      await this.saveCookies();
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not initialized. Call launch() first.');
    }
    return this.page;
  }

  async humanDelay(): Promise<void> {
    await randomDelay();
  }

  async humanScroll(): Promise<void> {
    if (!this.page) return;
    
    const scrollAmount = Math.floor(Math.random() * 500) + 200;
    await this.page.evaluate((amount: number) => {
      (globalThis as any).scrollBy(0, amount);
    }, scrollAmount);
    
    await this.humanDelay();
  }
}

export const browserManager = new BrowserManager();
