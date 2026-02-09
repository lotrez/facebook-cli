import { describe, test, expect } from 'bun:test';
import { randomDelay, formatDate, toMarkdownListings, toMarkdownMessages, toMarkdownConversations } from './utils';
import type { Listing, Message, Conversation } from '../types';

describe('Utils', () => {
  describe('randomDelay', () => {
    test('should return a promise', () => {
      const result = randomDelay();
      expect(result).toBeInstanceOf(Promise);
    });

    test('should resolve after a delay', async () => {
      const start = Date.now();
      await randomDelay();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('formatDate', () => {
    test('should format date to ISO string', () => {
      const date = new Date('2026-01-15T10:30:00Z');
      const formatted = formatDate(date);
      expect(formatted).toBe('2026-01-15T10:30:00.000Z');
    });
  });

  describe('toMarkdownListings', () => {
    test('should convert listings to markdown', () => {
      const listings: Listing[] = [
        {
          id: '123',
          title: 'Vintage Bike',
          price: 150,
          currency: 'USD',
          location: 'San Francisco, CA',
          description: 'A nice vintage bike in great condition',
          images: ['http://example.com/img1.jpg'],
          seller: { id: '456', name: 'John Doe' },
          url: 'https://facebook.com/marketplace/item/123',
          postedAt: new Date('2026-01-15'),
        },
      ];

      const markdown = toMarkdownListings(listings);
      expect(markdown).toContain('# Facebook Marketplace Search');
      expect(markdown).toContain('Vintage Bike');
      expect(markdown).toContain('$150');
      expect(markdown).toContain('San Francisco, CA');
      expect(markdown).toContain('John Doe');
    });

    test('should handle empty listings', () => {
      const markdown = toMarkdownListings([]);
      expect(markdown).toContain('No listings found');
    });
  });

  describe('toMarkdownMessages', () => {
    test('should convert messages to markdown', () => {
      const messages: Message[] = [
        {
          id: '1',
          conversationId: 'conv1',
          senderId: 'user1',
          senderName: 'Alice',
          text: 'Hello!',
          timestamp: new Date('2026-01-15T10:30:00Z'),
        },
        {
          id: '2',
          conversationId: 'conv1',
          senderId: 'user2',
          senderName: 'Bob',
          text: 'Hi there!',
          timestamp: new Date('2026-01-15T10:31:00Z'),
        },
      ];

      const markdown = toMarkdownMessages(messages);
      expect(markdown).toContain('# Conversation');
      expect(markdown).toContain('Alice');
      expect(markdown).toContain('Hello!');
      expect(markdown).toContain('Bob');
      expect(markdown).toContain('Hi there!');
    });

    test('should handle empty messages', () => {
      const markdown = toMarkdownMessages([]);
      expect(markdown).toContain('No messages');
    });
  });

  describe('toMarkdownConversations', () => {
    test('should convert conversations to markdown', () => {
      const conversations: Conversation[] = [
        {
          id: 'conv1',
          participants: [{ id: 'user1', name: 'Alice' }],
          lastMessage: {
            text: 'See you tomorrow!',
            timestamp: new Date('2026-01-15T10:30:00Z'),
            senderId: 'user1',
          },
          unreadCount: 2,
        },
      ];

      const markdown = toMarkdownConversations(conversations);
      expect(markdown).toContain('# Conversations');
      expect(markdown).toContain('Alice');
      expect(markdown).toContain('See you tomorrow!');
      expect(markdown).toContain('**Unread:** 2');
    });

    test('should handle empty conversations', () => {
      const markdown = toMarkdownConversations([]);
      expect(markdown).toContain('No conversations');
    });
  });
});
