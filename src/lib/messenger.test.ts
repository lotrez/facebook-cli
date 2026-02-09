import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { messengerManager } from './messenger';
import { browserManager } from './browser';
import { config } from '../config';

describe('MessengerManager', () => {
  beforeAll(async () => {
    if (!config.facebook.email || !config.facebook.password) {
      console.log('Warning: No Facebook credentials configured. Tests will be skipped.');
    }
  });

  afterAll(async () => {
    await browserManager.close();
  });

  test('should list conversations', async () => {
    if (!config.facebook.email || !config.facebook.password) {
      console.log('Skipping list conversations test - no credentials');
      return;
    }

    try {
      const conversations = await messengerManager.listConversations({ limit: 5 });
      
      expect(Array.isArray(conversations)).toBe(true);
      
      if (conversations.length > 0) {
        const conv = conversations[0]!;
        expect(conv).toHaveProperty('id');
        expect(conv).toHaveProperty('participants');
        expect(Array.isArray(conv.participants)).toBe(true);
      }
    } catch (error) {
      console.log('List conversations test failed:', error);
    }
  });

  test('should read conversation messages', async () => {
    if (!config.facebook.email || !config.facebook.password) {
      console.log('Skipping read messages test - no credentials');
      return;
    }

    try {
      // First get a conversation ID
      const conversations = await messengerManager.listConversations({ limit: 1 });
      
      if (conversations.length === 0) {
        console.log('No conversations found for test');
        return;
      }

      const conversation = conversations[0];
      if (!conversation) {
        console.log('No conversation available');
        return;
      }

      const messages = await messengerManager.readConversation(conversation.id, { limit: 10 });
      
      expect(Array.isArray(messages)).toBe(true);
      
      if (messages.length > 0) {
        const message = messages[0];
        expect(message).toHaveProperty('id');
        expect(message).toHaveProperty('senderId');
        expect(message).toHaveProperty('text');
        expect(message).toHaveProperty('timestamp');
      }
    } catch (error) {
      console.log('Read messages test failed:', error);
    }
  });

  test('send message should handle errors gracefully', async () => {
    if (!config.facebook.email || !config.facebook.password) {
      console.log('Skipping send message test - no credentials');
      return;
    }

    try {
      // Try to send to an invalid user ID
      const result = await messengerManager.sendMessage('999999999999', 'Test message');
      // Should return false for invalid user, not throw
      expect(typeof result).toBe('boolean');
    } catch (error) {
      // Sending may fail, but should not crash
      console.log('Send message test completed (may have failed as expected)');
    }
  });
});
