import { defineCommand, option } from '@bunli/core';
import { z } from 'zod';
import { messengerManager } from '../lib/messenger';
import { browserManager } from '../lib/browser';
import { toMarkdownConversations, toMarkdownMessages } from '../lib/utils';
import logger from '../lib/logger';

export const listCommand = defineCommand({
  name: 'list',
  description: 'List recent conversations',
  options: {
    limit: option(z.coerce.number().default(20), {
      description: 'Maximum conversations',
    }),
    format: option(z.enum(['json', 'markdown']).default('json'), {
      description: 'Output format',
    }),
    headed: option(z.coerce.boolean().default(false), {
      description: 'Show browser window (headed mode)',
    }),
  },
  handler: async ({ flags }) => {
    try {
      browserManager.setHeadless(!flags.headed);
      const conversations = await messengerManager.listConversations({
        limit: flags.limit,
      });
      
      if (flags.format === 'markdown') {
        console.log(toMarkdownConversations(conversations));
      } else {
        console.log(JSON.stringify({ conversations }, null, 2));
      }
    } catch (error) {
      logger.error(error, 'Failed to list conversations');
      process.exit(1);
    } finally {
      await browserManager.close();
    }
  },
});

export const readCommand = defineCommand({
  name: 'read',
  description: 'Read messages from a conversation',
  options: {
    'conversation-id': option(z.string().min(1), {
      description: 'Conversation ID',
    }),
    limit: option(z.coerce.number().default(50), {
      description: 'Maximum messages',
    }),
    format: option(z.enum(['json', 'markdown']).default('json'), {
      description: 'Output format',
    }),
    headed: option(z.coerce.boolean().default(false), {
      description: 'Show browser window (headed mode)',
    }),
  },
  handler: async ({ flags }) => {
    try {
      browserManager.setHeadless(!flags.headed);
      const messages = await messengerManager.readConversation(
        flags['conversation-id'],
        { limit: flags.limit }
      );
      
      if (flags.format === 'markdown') {
        console.log(toMarkdownMessages(messages));
      } else {
        console.log(JSON.stringify({ messages }, null, 2));
      }
    } catch (error) {
      logger.error(error, 'Failed to read messages');
      process.exit(1);
    } finally {
      await browserManager.close();
    }
  },
});

export const sendCommand = defineCommand({
  name: 'send',
  description: 'Send a message to a user',
  options: {
    'user-id': option(z.string().min(1), {
      description: 'User ID',
    }),
    message: option(z.string().min(1), {
      description: 'Message text',
    }),
    headed: option(z.coerce.boolean().default(false), {
      description: 'Show browser window (headed mode)',
    }),
  },
  handler: async ({ flags }) => {
    try {
      browserManager.setHeadless(!flags.headed);
      const success = await messengerManager.sendMessage(
        flags['user-id'],
        flags.message
      );
      
      if (success) {
        console.log(JSON.stringify({ success: true, message: 'Message sent' }, null, 2));
      } else {
        logger.error('Failed to send message');
        process.exit(1);
      }
    } catch (error) {
      logger.error(error, 'Failed to send message');
      process.exit(1);
    } finally {
      await browserManager.close();
    }
  },
});
