import { browserManager } from './browser';
import { authManager } from './auth';
import { randomDelay } from './utils';
import type { Conversation, Message, MessageOptions } from '../types';

export class MessengerManager {
  async listConversations(options: MessageOptions = {}): Promise<Conversation[]> {
    await authManager.ensureLoggedIn();
    const page = browserManager.getPage();
    
    console.error('Fetching conversations...');
    
    // Navigate to messenger
    await page.goto('https://www.facebook.com/messages', { waitUntil: 'networkidle' });
    await randomDelay();
    
    // Wait for conversations to load
    try {
      await page.waitForSelector('[role="main"], [data-testid="mw_thread_list"]', { timeout: 10000 });
    } catch (error) {
      console.error('Could not load conversations');
      return [];
    }
    
    // Extract conversations
    const conversations = await page.evaluate((limit) => {
      const items: any[] = [];
      
      // Try multiple selectors for conversation items
      const selectors = [
        '[data-testid="mw_thread_list"] [role="link"]',
        '[role="main"] a[href*="/messages/t/"]',
        '[data-testid="mw_thread_list_item"]',
      ];
      
      let elements: Element[] = [];
      for (const selector of selectors) {
        elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) break;
      }
      
      elements.slice(0, limit).forEach((el, index) => {
        const link = el.closest('a') || el;
        const href = link.getAttribute('href') || '';
        const idMatch = href.match(/\/messages\/t\/(\d+)/);
        const id = idMatch ? idMatch[1] : `conv_${index}`;
        
        // Extract participant names
        const text = el.textContent || '';
        const nameMatch = text.match(/^([^·]+)/);
        const name = nameMatch?.[1]?.trim() ?? 'Unknown';
        
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
    
    return conversations as Conversation[];
  }

  async readConversation(conversationId: string, options: MessageOptions = {}): Promise<Message[]> {
    await authManager.ensureLoggedIn();
    const page = browserManager.getPage();
    
    console.error(`Reading conversation: ${conversationId}`);
    
    // Navigate to specific conversation
    await page.goto(`https://www.facebook.com/messages/t/${conversationId}`, { waitUntil: 'networkidle' });
    await randomDelay();
    
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
    await page.goto(`https://www.facebook.com/messages/t/${userId}`, { waitUntil: 'networkidle' });
    await randomDelay();
    
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
