import { browserManager } from './browser';
import { authManager } from './auth';
import { config } from '../config';
import { randomDelay } from './utils';
import type { Conversation, Message, MessageOptions } from '../types';

export class MessengerManager {
  private async handlePinChallenge(): Promise<boolean> {
    const page = browserManager.getPage();
    
    // Wait a moment for any PIN dialog to appear
    await page.waitForTimeout(3000);
    
    if (!config.facebook.pin) {
      console.error('No PIN configured in FACEBOOK_PIN env variable');
      return false;
    }
    
    // Check for PIN dialog by looking for specific text or elements
    // Facebook Messenger PIN dialog typically has specific text
    const pageContent = await page.content();
    const hasPinDialog = pageContent.includes('PIN') || 
                        pageContent.includes('pin') ||
                        pageContent.includes('code') ||
                        pageContent.includes('unlock');
    
    if (!hasPinDialog) {
      console.error('No PIN dialog detected');
      return true;
    }
    
    console.error('PIN dialog detected, looking for input field...');
    
    // Try to find PIN input - specifically looking for numeric inputs or PIN-related fields
    // Avoid general password fields which might be login forms
    const pinSelectors = [
      'input[placeholder*="PIN" i]',
      'input[name*="pin" i]',
      'input[aria-label*="PIN" i]',
      'input[type="tel"]', // PIN codes are often tel type
      'input[inputmode="numeric"]',
      '[role="dialog"] input[type="password"]', // Password in a dialog is likely PIN
      '[role="alertdialog"] input',
    ];
    
    for (const selector of pinSelectors) {
      try {
        const inputs = await page.locator(selector).all();
        if (inputs.length > 0) {
          console.error(`Found ${inputs.length} potential PIN inputs with selector: ${selector}`);
          
          for (const input of inputs) {
            try {
              console.error('Attempting to enter PIN...');
              
              await input.fill(config.facebook.pin);
              console.error('PIN entered');
              await randomDelay();
              
              // Try to find and click a submit button first
              const submitButton = await page.locator('button[type="submit"], button:has-text("OK"), button:has-text("Submit"), [role="dialog"] button').first();
              try {
                if (await submitButton.count() > 0) {
                  await submitButton.click();
                  console.error('Clicked submit button');
                } else {
                  // Press Enter as fallback
                  await input.press('Enter');
                  console.error('Pressed Enter to submit PIN');
                }
              } catch (e) {
                // Page might have navigated, that's OK
                console.error('Submit action completed (page may have navigated)');
              }
              
              // Wait for page to process PIN
              await randomDelay();
              await randomDelay();
              await randomDelay();
              
              console.error('PIN submission completed');
              return true;
            } catch (e) {
              console.error('Failed to enter PIN:', e);
              continue;
            }
          }
        }
      } catch (error) {
        // Continue to next selector
      }
    }
    
    console.error('Could not find PIN input field');
    return false;
  }

  async listConversations(options: MessageOptions = {}): Promise<Conversation[]> {
    await authManager.ensureLoggedIn();
    const page = browserManager.getPage();
    
    console.error('Fetching conversations...');
    
    // Navigate to facebook.com/messages (uses same session as main Facebook)
    await page.goto('https://www.facebook.com/messages', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay();
    await randomDelay(); // Extra wait for PIN dialog
    
    // Check current URL
    let currentUrl = page.url();
    console.error('URL after navigation:', currentUrl);
    
    // Handle PIN challenge if present (Facebook sometimes asks for PIN when accessing messages)
    console.error('Checking for PIN challenge...');
    const pinHandled = await this.handlePinChallenge();
    if (!pinHandled) {
      console.error('WARNING: PIN challenge not handled - messages may not load');
    }
    
    // Wait for content to load after PIN
    await randomDelay();
    await randomDelay();
    
    // Check current URL again
    currentUrl = page.url();
    console.error('URL after PIN handling:', currentUrl);
    
    // After PIN, check if we're in the messages interface
    // The conversation list should be visible on the left side
    console.error('Waiting for conversation list to load...');
    await randomDelay();
    await randomDelay();
    
    // Debug: Log what we see on the page
    const debugLinks = await page.locator('a[href*="/messages/t/"]').count();
    console.error(`Debug: Found ${debugLinks} message thread links on page`);
    
    // Extract conversations
    const conversations = await page.evaluate((limit) => {
      const items: any[] = [];
      
      // Try multiple selectors for conversation items
      const selectors = [
        '[data-testid="mw_thread_list"] [role="link"]',
        '[role="main"] a[href*="/messages/t/"]',
        '[data-testid="mw_thread_list_item"]',
        '[data-pagelet="MessengerContent"] a[href*="/messages/t/"]',
        'a[href*="/messages/t/"]',
      ];
      
      let elements: Element[] = [];
      for (const selector of selectors) {
        elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) {
          console.error(`Found ${elements.length} conversations with selector: ${selector}`);
          break;
        }
      }
      
      elements.slice(0, limit).forEach((el, index) => {
        const link = el.closest('a') || el;
        const href = link.getAttribute('href') || '';
        const idMatch = href.match(/\/messages\/t\/(\d+)/);
        const id = idMatch ? idMatch[1] : `conv_${index}`;
        
        // Extract participant names - try multiple approaches
        let name = 'Unknown';
        const text = el.textContent || '';
        
        // Try to find name in aria-label or text content
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) {
          const splitName = ariaLabel.split(',')[0];
          name = splitName ? splitName : 'Unknown';
        } else {
          const nameMatch = text.match(/^([^·\n]+)/);
          name = nameMatch?.[1]?.trim() ?? 'Unknown';
        }
        
        // Extract last message preview
        const lines = text.split('·').map(s => s.trim());
        const lastMessageText = lines[1] || '';
        
        items.push({
          id,
          participants: [{ id: '', name }],
          lastMessage: lastMessageText ? {
            text: lastMessageText,
            timestamp: new Date(),
            senderId: '',
          } : undefined,
          unreadCount: 0,
        });
      });
      
      return items;
    }, options.limit || 20);
    
    console.error(`Retrieved ${conversations.length} conversations`);
    return conversations as Conversation[];
  }

  async readConversation(conversationId: string, options: MessageOptions = {}): Promise<Message[]> {
    await authManager.ensureLoggedIn();
    const page = browserManager.getPage();
    
    console.error(`Reading conversation: ${conversationId}`);
    
    // Navigate to specific conversation
    await page.goto(`https://www.facebook.com/messages/t/${conversationId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay();
    
    // Handle PIN challenge if present
    await this.handlePinChallenge();
    
    // Wait for messages to load
    try {
      await page.waitForSelector('[role="main"], [data-testid="message_container"]', { timeout: 10000 });
    } catch (error) {
      console.error('Could not load messages');
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
    
    console.error(`Sending message to user: ${userId}`);
    
    // Navigate to conversation with user
    await page.goto(`https://www.facebook.com/messages/t/${userId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay();
    
    // Handle PIN challenge if present
    await this.handlePinChallenge();
    
    // Wait for message input
    try {
      await page.waitForSelector('[contenteditable="true"], textarea, [role="textbox"]', { timeout: 10000 });
    } catch (error) {
      console.error('Could not find message input');
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
      console.error('Could not find message input field');
      return false;
    }
    
    await randomDelay();
    
    // Send message (press Enter)
    await page.keyboard.press('Enter');
    await randomDelay();
    
    console.error('Message sent successfully');
    return true;
  }
}

export const messengerManager = new MessengerManager();
