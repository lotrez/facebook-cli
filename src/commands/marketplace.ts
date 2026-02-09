import { defineCommand, option } from '@bunli/core';
import { z } from 'zod';
import { marketplaceManager } from '../lib/marketplace';
import { browserManager } from '../lib/browser';
import { toMarkdownListings } from '../lib/utils';

export const searchCommand = defineCommand({
  name: 'search',
  description: 'Search Facebook Marketplace listings',
  options: {
    query: option(z.string().min(1), {
      description: 'Search query',
      short: 'q',
    }),
    location: option(z.string().optional(), {
      description: 'Location (e.g., "San Francisco, CA")',
      short: 'l',
    }),
    radius: option(z.coerce.number().optional(), {
      description: 'Search radius in miles',
      short: 'r',
    }),
    'min-price': option(z.coerce.number().optional(), {
      description: 'Minimum price',
    }),
    'max-price': option(z.coerce.number().optional(), {
      description: 'Maximum price',
    }),
    category: option(z.string().optional(), {
      description: 'Category filter',
    }),
    limit: option(z.coerce.number().default(20), {
      description: 'Maximum results',
    }),
    format: option(z.enum(['json', 'markdown']).default('json'), {
      description: 'Output format',
    }),
  },
  handler: async ({ flags }) => {
    try {
      const listings = await marketplaceManager.search({
        query: flags.query,
        location: flags.location,
        radius: flags.radius,
        minPrice: flags['min-price'],
        maxPrice: flags['max-price'],
        category: flags.category,
        limit: flags.limit,
      });
      
      if (flags.format === 'markdown') {
        console.log(toMarkdownListings(listings));
      } else {
        console.log(JSON.stringify({ listings }, null, 2));
      }
    } catch (error) {
      console.error('Search failed:', error);
      process.exit(1);
    } finally {
      await browserManager.close();
    }
  },
});

export const listingCommand = defineCommand({
  name: 'listing',
  description: 'Get detailed information about a specific listing',
  options: {
    id: option(z.string().min(1), {
      description: 'Listing ID',
    }),
    format: option(z.enum(['json', 'markdown']).default('json'), {
      description: 'Output format',
    }),
  },
  handler: async ({ flags }) => {
    try {
      const listing = await marketplaceManager.getListing(flags.id);
      
      if (!listing) {
        console.error('Listing not found');
        process.exit(1);
      }
      
      if (flags.format === 'markdown') {
        console.log(toMarkdownListings([listing]));
      } else {
        console.log(JSON.stringify(listing, null, 2));
      }
    } catch (error) {
      console.error('Failed to fetch listing:', error);
      process.exit(1);
    } finally {
      await browserManager.close();
    }
  },
});
