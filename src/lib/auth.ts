import { browserManager } from './browser';
import { config, validateConfig } from '../config';
import { randomDelay } from './utils';
import logger from './logger';

export class AuthManager {
  private isLoggedIn = false;

  async ensureLoggedIn(): Promise<void> {
    if (this.isLoggedIn) {
      return;
    }

    validateConfig();
    
    const page = await browserManager.launch();
    
    logger.info('Checking login status...');
    
    // Check if already logged in via cookies - use shorter timeout and domcontentloaded
    try {
      await page.goto('https://facebook.com', { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
    } catch (error) {
      logger.warn('Initial navigation timeout, proceeding to login...');
    }
    
    await randomDelay();
    
    // Check if we're already on the main page (logged in)
    const currentUrl = page.url();
    logger.debug(`Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('facebook.com') && !currentUrl.includes('login') && !currentUrl.includes('checkpoint')) {
      // Check for navigation or main content
      try {
        const hasNav = await page.locator('[role="navigation"], [data-testid="royal_header"]').count() > 0;
        const hasFeed = await page.locator('[role="main"], [data-testid="news_feed_stream"]').count() > 0;
        
        if (hasNav || hasFeed) {
          logger.info('Already logged in via saved session');
          this.isLoggedIn = true;
          return;
        }
      } catch (error) {
        logger.error(error, 'Error checking login status');
      }
    }
    
    // Need to login
    await this.login();
  }

  private async login(): Promise<void> {
    const page = browserManager.getPage();
    
    logger.info('Logging in...');
    
    // Navigate to login page with shorter timeout
    try {
      await page.goto('https://facebook.com/login', { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
    } catch (error) {
      logger.warn('Login page navigation timeout');
    }
    
    await randomDelay();
    
    // Check if email field exists
    const emailField = await page.locator('#email').count();
    if (emailField === 0) {
      logger.warn('Email field not found, checking current page...');
      const url = page.url();
      logger.debug(`Current URL: ${url}`);
      
      // Might already be logged in
      if (!url.includes('login')) {
        logger.info('Appears to already be logged in');
        this.isLoggedIn = true;
        return;
      }
      
      throw new Error('Login form not found');
    }
    
    // Fill in email
    await page.fill('#email', config.facebook.email);
    await randomDelay();
    
    // Fill in password
    await page.fill('#pass', config.facebook.password);
    await randomDelay();
    
    // Click login button
    await page.click('button[name="login"]');
    
    // Wait for navigation with longer timeout
    try {
      await page.waitForURL(/facebook\.com\/(?!login)/, { timeout: 60000 });
    } catch (error) {
      // Check current URL
      const url = page.url();
      logger.debug(`Current URL after login attempt: ${url}`);
      
      // Check for 2FA or other challenges
      if (url.includes('checkpoint') || url.includes('two_factor') || url.includes('security')) {
        throw new Error('2FA or security check required. Please login manually first with --headed flag.');
      }
      
      // Check if we're actually logged in but URL didn't change as expected
      const hasNav = await page.locator('[role="navigation"]').count() > 0;
      if (hasNav) {
        logger.info('Login appears successful despite URL check');
      } else {
        throw new Error('Login failed. Check your credentials or use --headed flag to debug.');
      }
    }
    
    await randomDelay();
    
    // Save cookies for future sessions
    await browserManager.saveCookies();
    
    this.isLoggedIn = true;
    logger.info('Login successful');
  }

  async logout(): Promise<void> {
    const page = browserManager.getPage();
    
    try {
      await page.goto('https://facebook.com/logout.php', { waitUntil: 'domcontentloaded' });
      await randomDelay();
    } catch (error) {
      // Ignore errors during logout
    }
    
    this.isLoggedIn = false;
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn;
  }
}

export const authManager = new AuthManager();
