import { browserManager } from './browser';
import { authManager } from './auth';
import { config } from '../config';
import { randomDelay } from './utils';
import logger from './logger';
import type { Conversation, Message, MessageOptions } from '../types';

export class MessengerManager {
  private async handlePinChallenge(): Promise<boolean> {
    const page = browserManager.getPage();
    
    // Wait a moment for any PIN dialog to appear
    await page.waitForTimeout(3000);
    
    if (!config.facebook.pin) {
      logger.warn('No PIN configured in FACEBOOK_PIN env variable');
      return false;
    }
    
    // Check for PIN input in the Messenger popup
    const pinSelectors = [
      'input[placeholder*="PIN" i]',
      'input[name*="pin" i]',
      'input[aria-label*="PIN" i]',
      'input[type="tel"]', // PIN codes are often tel type
      'input[inputmode="numeric"]',
      '[role="dialog"] input[type="password"]',
      '[role="alertdialog"] input',
    ];
    
    for (const selector of pinSelectors) {
      try {
        const inputs = await page.locator(selector).all();
        if (inputs.length > 0) {
          logger.debug(`Found ${inputs.length} potential PIN inputs with selector: ${selector}`);
          
          for (const input of inputs) {
            try {
              logger.debug('Attempting to enter PIN...');
              
              await input.fill(config.facebook.pin);
              logger.debug('PIN entered');
              await randomDelay();
              
              // Try to find and click a submit button first
              const submitButton = await page.locator('button[type="submit"], button:has-text("OK"), button:has-text("Submit"], [role="dialog"] button').first();
              try {
                if (await submitButton.count() > 0) {
                  await submitButton.click();
                  logger.debug('Clicked submit button');
                } else {
                  // Press Enter as fallback
                  await input.press('Enter');
                  logger.debug('Pressed Enter to submit PIN');
                }
              } catch (e) {
                // Page might have navigated, that's OK
                logger.debug('Submit action completed (page may have navigated)');
              }
              
              // Wait for page to process PIN
              await randomDelay();
              await randomDelay();
              await randomDelay();
              
              logger.info('PIN submission completed');
              return true;
            } catch (e) {
              logger.error(e, 'Failed to enter PIN');
              continue;
            }
          }
        }
      } catch (error) {
        // Continue to next selector
      }
    }
    
    logger.debug('No PIN input found or PIN already handled');
    return true;
  }

  async listConversations(options: MessageOptions = {}): Promise<Conversation[]> {
    await authManager.ensureLoggedIn();
    const page = browserManager.getPage();
    
    logger.info('Fetching conversations...');
    
    // Navigate to messages page
    logger.debug('Navigating to messages...');
    await page.goto('https://www.facebook.com/messages/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay();
    await randomDelay();
    
    // Handle PIN challenge if present
    logger.debug('Checking for PIN challenge...');
    const pinHandled = await this.handlePinChallenge();
    if (!pinHandled) {
      logger.warn('PIN challenge not handled - messages may not load');
    }
    
    // Wait for sidebar to load
    await randomDelay();
    await randomDelay();
    await randomDelay();
    
    // Look for the sidebar with conversation list and find Marketplace button
    logger.debug('Looking for conversation list sidebar...');
    
    // Try to find the sidebar navigation
    const sidebarSelectors = [
      '[role="navigation"][aria-label*="discussions"]',
      '[aria-label*="Liste des discussions"]',
      'nav[aria-label*="discussions"]',
      '[role="navigation"]',
    ];
    
    let sidebar = null;
    for (const selector of sidebarSelectors) {
      try {
        const count = await page.locator(selector).count();
        logger.debug(`Sidebar selector "${selector}" found ${count} elements`);
        if (count > 0) {
          sidebar = await page.locator(selector).first();
          break;
        }
      } catch (e) {
        logger.error(e, `Error with sidebar selector ${selector}`);
      }
    }
    
    // Look for Marketplace button anywhere on the page
    logger.debug('Looking for Marketplace button on page...');
    const marketplaceSelectors = [
      'button:has-text("Marketplace")',
      '[role="button"]:has-text("Marketplace")',
      'button[aria-label*="Marketplace"]',
      'button:has(span:has-text("Marketplace"))',
    ];
    
    let marketplaceClicked = false;
    for (const selector of marketplaceSelectors) {
      try {
        const buttons = await page.locator(selector).all();
        logger.debug(`Selector "${selector}" found ${buttons.length} buttons`);
        
        for (const btn of buttons) {
          const text = (await btn.textContent().catch(() => '')) ?? '';
          logger.debug(`Button text: "${text}"`);
          if (text.toLowerCase().includes('marketplace')) {
            logger.debug(`Found Marketplace button: ${text}`);
            await btn.click();
            logger.debug('Clicked on Marketplace button');
            await randomDelay();
            await randomDelay();
            await randomDelay();
            marketplaceClicked = true;
            break;
          }
        }
        if (marketplaceClicked) break;
      } catch (e) {
        logger.error(e, `Error with selector ${selector}`);
      }
    }
    
    if (!marketplaceClicked) {
      logger.warn('Could not click Marketplace button, continuing anyway...');
    }
    
    // Wait for Marketplace grid to load
    await randomDelay();
    await randomDelay();
    
    // Extract conversations using Playwright locators
    logger.debug('Extracting conversations...');
    
    const conversations: Conversation[] = [];
    
    // Try multiple selectors to find conversation links
    const linkSelectors = [
      'a[href*="/messages/t/"][role="link"]',
      '[role="grid"] a[href*="/messages/t/"]',
      'a[href*="/messages/t/"]',
    ];
    
    let links: any[] = [];
    for (const selector of linkSelectors) {
      try {
        const count = await page.locator(selector).count();
        logger.debug(`Selector "${selector}" found ${count} elements`);
        if (count > 0) {
          links = await page.locator(selector).all();
          logger.debug(`Found ${links.length} conversation links with selector: ${selector}`);
          break;
        }
      } catch (e) {
        logger.error(e, `Error with selector "${selector}"`);
      }
    }
    
    for (const link of links.slice(0, options.limit || 20)) {
      try {
        const href = await link.getAttribute('href') || '';
        const idMatch = href.match(/\/messages\/t\/(\d+)/);
        if (!idMatch) continue;
        
        const id = idMatch[1];
        const text = await link.textContent() || '';
        
        // Parse the text to extract name, title, message, and time
        // Format: "Name · Listing Title Message · Time"
        const parts = text.split('·').map((p: string) => p.trim());
        
        let name = 'Unknown';
        let lastMessageText = '';
        let time = '';
        
        if (parts.length >= 2) {
          // First part usually contains name
          const firstPart = parts[0];
          name = firstPart ? firstPart : 'Unknown';
          
          // Last part is usually the time
          const lastPart = parts[parts.length - 1];
          time = lastPart ? lastPart : '';
          
          // Middle parts contain the message
          if (parts.length > 2) {
            lastMessageText = parts.slice(1, -1).join(' · ');
          }
        }
        
        // Clean up the name (remove listing title if present)
        const nameParts = name.split('·');
        if (nameParts.length > 1 && nameParts[0]) {
          name = nameParts[0].trim();
        }
        
        conversations.push({
          id,
          participants: [{ id: '', name }],
          lastMessage: lastMessageText ? {
            text: lastMessageText,
            timestamp: new Date(),
            senderId: '',
          } : undefined,
          unreadCount: 0,
        });
      } catch (e) {
        logger.error(e, 'Failed to extract conversation');
      }
    }
    
    logger.info(`Retrieved ${conversations.length} conversations`);
    return conversations;
  }

  async readConversation(conversationId: string, options: MessageOptions = {}): Promise<Message[]> {
    await authManager.ensureLoggedIn();
    const page = browserManager.getPage();
    
    logger.info(`Reading conversation: ${conversationId}`);
    
    // Navigate to specific conversation
    await page.goto(`https://www.facebook.com/messages/t/${conversationId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay();
    
    // Handle PIN challenge if present
    await this.handlePinChallenge();
    
    // Wait for messages to load
    try {
      await page.waitForSelector('[role="main"], [data-testid="message_container"]', { timeout: 10000 });
    } catch (error) {
      logger.error('Could not load messages');
      return [];
    }
    
    // Scroll up to load more messages
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const container = document.querySelector('[role="main"]') || document.body;
        container.scrollTop = 0;
      });
      await randomDelay();
    }
    
    // Extract messages
    const messages = await page.evaluate((limit) => {
      const items: any[] = [];
      
      // Try multiple selectors for message bubbles
      const selectors = [
        '[data-testid="message_container"]',
        '[role="main"] div[dir="auto"]',
        '[data-testid="message_text"]',
        '[data-testid="message_content"]',
        '[data-pagelet="MessengerContent"] div[dir="auto"]',
      ];
      
      let elements: Element[] = [];
      for (const selector of selectors) {
        elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) break;
      }
      
      elements.slice(-limit).forEach((el, index) => {
        const text = el.textContent?.trim() || '';
        if (!text || text.length < 2) return;
        
        // Try to determine if sent or received
        const isSent = el.closest('[data-testid*="sent"]') !== null || 
                      el.getAttribute('style')?.includes('background-color') ||
                      el.closest('div[role="gridcell"]')?.getAttribute('style')?.includes('flex-end') ||
                      false;
        
        items.push({
          id: `msg_${index}`,
          conversationId: '',
          senderId: isSent ? 'me' : 'them',
          senderName: isSent ? 'Me' : 'Other',
          text,
          timestamp: new Date(),
        });
      });
      
      return items;
    }, options.limit || 50);
    
    return messages.map(m => ({ ...m, conversationId })) as Message[];
  }

  async sendMessage(userId: string, message: string): Promise<boolean> {
    await authManager.ensureLoggedIn();
    const page = browserManager.getPage();
    
    logger.info(`Sending message to user: ${userId}`);
    
    // Navigate to conversation with user
    await page.goto(`https://www.facebook.com/messages/t/${userId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay();
    
    // Handle PIN challenge if present
    await this.handlePinChallenge();
    
    // Wait for message input
    try {
      await page.waitForSelector('[contenteditable="true"], textarea, [role="textbox"]', { timeout: 10000 });
    } catch (error) {
      logger.error('Could not find message input');
      return false;
    }
    
    // Find and fill message input
    const inputSelectors = [
      '[contenteditable="true"]',
      'textarea[placeholder*="Message"]',
      '[role="textbox"]',
    ];
    
    let inputFound = false;
    for (const selector of inputSelectors) {
      try {
        await page.fill(selector, message);
        inputFound = true;
        break;
      } catch (error) {
        continue;
      }
    }
    
    if (!inputFound) {
      logger.error('Could not find message input field');
      return false;
    }
    
    await randomDelay();
    
    // Send message (press Enter)
    await page.keyboard.press('Enter');
    await randomDelay();
    
    logger.info('Message sent successfully');
    return true;
  }
}

export const messengerManager = new MessengerManager();
