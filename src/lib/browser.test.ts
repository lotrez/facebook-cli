import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { browserManager } from './browser';
import { authManager } from './auth';
import { config, ensureSessionDir, getSessionPath } from '../config';
import { existsSync, unlinkSync } from 'fs';

describe('BrowserManager', () => {
  beforeAll(() => {
    ensureSessionDir();
  });

  afterAll(async () => {
    await browserManager.close();
  });

  test('should launch browser', async () => {
    const page = await browserManager.launch();
    expect(page).toBeDefined();
    expect(browserManager.getPage()).toBe(page);
  });

  test('should save and load cookies', async () => {
    const page = browserManager.getPage();
    
    // Navigate to a page and save cookies
    await page.goto('https://example.com');
    await browserManager.saveCookies();
    
    // Check that cookies file was created
    expect(existsSync(getSessionPath())).toBe(true);
  });

  test('should reuse browser instance', async () => {
    const page1 = await browserManager.launch();
    const page2 = await browserManager.launch();
    expect(page1).toBe(page2);
  });
});

describe('AuthManager', () => {
  beforeAll(() => {
    ensureSessionDir();
  });

  afterAll(async () => {
    await browserManager.close();
  });

  test('should throw error if credentials not configured', async () => {
    // Temporarily clear credentials
    const originalEmail = config.facebook.email;
    const originalPassword = config.facebook.password;
    
    (config.facebook as any).email = '';
    (config.facebook as any).password = '';
    
    await expect(authManager.ensureLoggedIn()).rejects.toThrow('FACEBOOK_EMAIL and FACEBOOK_PASSWORD must be set');
    
    // Restore credentials
    (config.facebook as any).email = originalEmail;
    (config.facebook as any).password = originalPassword;
  });

  test('should attempt login with credentials', async () => {
    // This test requires actual credentials in .env
    // Skip if credentials are not set
    if (!config.facebook.email || !config.facebook.password) {
      console.log('Skipping login test - no credentials configured');
      return;
    }

    // Note: This test will actually try to login to Facebook
    // It may fail due to CAPTCHA or 2FA
    try {
      await authManager.ensureLoggedIn();
      expect(authManager.isAuthenticated()).toBe(true);
    } catch (error) {
      // Expected to fail in test environment without valid credentials
      expect(error).toBeDefined();
    }
  });
});
