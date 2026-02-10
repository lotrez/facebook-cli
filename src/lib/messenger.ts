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
          console.error(`Found ${inputs.length} potential PIN inputs with selector: ${selector}`);
          
          for (const input of inputs) {
            try {
              console.error('Attempting to enter PIN...');
              
              await input.fill(config.facebook.pin);
              console.error('PIN entered');
              await randomDelay();
              
              // Try to find and click a submit button first
              const submitButton = await page.locator('button[type="submit"], button:has-text("OK"), button:has-text("Submit"], [role="dialog"] button').first();
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
    
    console.error('No PIN input found or PIN already handled');
    return true;
  }

  async listConversations(options: MessageOptions = {}): Promise<Conversation[]> {
    await authManager.ensureLoggedIn();
    const page = browserManager.getPage();
    
    console.error('Fetching conversations...');
    
    // Click on Messenger button to open the dropdown
    console.error('Clicking Messenger button...');
    const messengerBtn = await page.locator('button[aria-label*="Messenger"], button[aria-label*="messages" i], [aria-label="Contrôles et paramètres du compte"] button:nth-child(2)').first();
    if (await messengerBtn.count() > 0) {
      await messengerBtn.click();
      console.error('Clicked Messenger button');
      await randomDelay();
      await randomDelay();
    }
    
    // Handle PIN challenge if present in the popup
    console.error('Checking for PIN challenge...');
    const pinHandled = await this.handlePinChallenge();
    if (!pinHandled) {
      console.error('WARNING: PIN challenge not handled - messages may not load');
    }
    
    // Click on Marketplace tab in the popup
    console.error('Looking for Marketplace tab...');
    const marketplaceSelectors = [
      'button:has-text("Marketplace")',
      '[role="dialog"] button:has-text("Marketplace")',
      '[role="grid"] button:has-text("Marketplace")',
      'span:has-text("Marketplace")',
    ];
    
    for (const selector of marketplaceSelectors) {
      try {
        const buttons = await page.locator(selector).all();
        for (const btn of buttons) {
          const text = await btn.textContent() || '';
          if (text.includes('Marketplace')) {
            console.error(`Found Marketplace button: ${text}`);
            await btn.click();
            console.error('Clicked on Marketplace');
            await randomDelay();
            await randomDelay();
            await randomDelay(); // Wait for conversations to load
            break;
          }
        }
        if (buttons.length > 0) break;
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Wait for conversation list to load
    console.error('Waiting for conversation list to load...');
    await randomDelay();
    await randomDelay();
    
    // Extract conversations from the Marketplace grid
    const conversations = await page.evaluate((limit) => {
      const items: any[] = [];
      
      // Look for the Marketplace grid
      const gridSelectors = [
        'grid[aria-label="Marketplace"]',
        '[role="grid"][aria-label*="Marketplace"]',
        '[aria-label="Marketplace"] [role="grid"]',
        '[role="grid"]',
      ];
      
      let grid: Element | null = null;
      for (const selector of gridSelectors) {
        grid = document.querySelector(selector);
        if (grid) {
          console.error(`Found grid with selector: ${selector}`);
          break;
        }
      }
      
      if (!grid) {
        console.error('No Marketplace grid found');
        return items;
      }
      
      // Find all rows (conversations) in the grid
      const rows = grid.querySelectorAll('[role="row"], .x1n2onr6');
      console.error(`Found ${rows.length} rows in grid`);
      
      rows.forEach((row, index) => {
        // Find the link in the row
        const link = row.querySelector('a[href*="/messages/t/"]');
        if (!link) return;
        
        const href = link.getAttribute('href') || '';
        const idMatch = href.match(/\/messages\/t\/(\d+)/);
        if (!idMatch) return;
        
        const id = idMatch[1];
        
        // Extract text content
        const text = link.textContent || '';
        
        // Parse the text to extract name, title, message, and time
        // Format: "Name · Listing Title Message · Time"
        const parts = text.split('·').map(p => p.trim());
        
        let name = 'Unknown';
        let title = '';
        let lastMessageText = '';
        let time = '';
        
        if (parts.length >= 2) {
          // First part usually contains name and title
          const firstPart = parts[0] ?? '';
          const nameTitleMatch = firstPart.match(/^([^·]+)\s*·\s*(.+)$/);
          if (nameTitleMatch && nameTitleMatch[1]) {
            name = nameTitleMatch[1].trim();
            if (nameTitleMatch[2]) {
              title = nameTitleMatch[2].trim();
            }
          } else {
            name = firstPart;
          }
          
          // Last part is usually the time
          const lastPart = parts[parts.length - 1];
          time = lastPart ?? '';
          
          // Middle parts contain the message
          if (parts.length > 2) {
            const middleParts = parts.slice(1, -1);
            lastMessageText = middleParts.filter((p): p is string => !!p).join(' · ');
          }
        }
        
        items.push({
          id,
          participants: [{ id: '', name }],
          title,
          lastMessage: lastMessageText ? {
            text: lastMessageText,
            timestamp: new Date(),
            senderId: '',
          } : undefined,
          time,
          unreadCount: 0,
        });
      });
      
      return items.slice(0, limit);
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
