import { browserManager } from './browser';
import { config, validateConfig } from '../config';
import { randomDelay } from './utils';

export class AuthManager {
  private isLoggedIn = false;

  async ensureLoggedIn(): Promise<void> {
    if (this.isLoggedIn) {
      return;
    }

    validateConfig();
    
    const page = await browserManager.launch();
    
    // Check if already logged in via cookies
    await page.goto('https://facebook.com', { waitUntil: 'networkidle' });
    await randomDelay();
    
    // Check if we're already on the main page (logged in)
    const currentUrl = page.url();
    if (currentUrl.includes('facebook.com') && !currentUrl.includes('login')) {
      const hasNav = await page.locator('[role="navigation"]').count() > 0;
      if (hasNav) {
        this.isLoggedIn = true;
        return;
      }
    }
    
    // Need to login
    await this.login();
  }

  private async login(): Promise<void> {
    const page = browserManager.getPage();
    
    console.error('Logging in...');
    
    // Navigate to login page
    await page.goto('https://facebook.com/login', { waitUntil: 'networkidle' });
    await randomDelay();
    
    // Fill in email
    await page.fill('#email', config.facebook.email);
    await randomDelay();
    
    // Fill in password
    await page.fill('#pass', config.facebook.password);
    await randomDelay();
    
    // Click login button
    await page.click('button[name="login"]');
    
    // Wait for navigation
    try {
      await page.waitForURL(/facebook\.com\/(?!login)/, { timeout: 30000 });
    } catch (error) {
      // Check for 2FA or other challenges
      const url = page.url();
      if (url.includes('checkpoint') || url.includes('two_factor')) {
        throw new Error('2FA or security check required. Please login manually first.');
      }
      throw new Error('Login failed. Check your credentials.');
    }
    
    await randomDelay();
    
    // Save cookies for future sessions
    await browserManager.saveCookies();
    
    this.isLoggedIn = true;
    console.error('Login successful');
  }

  async logout(): Promise<void> {
    const page = browserManager.getPage();
    
    try {
      await page.goto('https://facebook.com/logout.php', { waitUntil: 'networkidle' });
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
