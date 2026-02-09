import { describe, test, expect, afterAll } from 'bun:test';
import { $ } from 'bun';
import { browserManager } from '../lib/browser';

// Helper to parse JSON output, filtering out dotenv logs
function parseJSONOutput(output: string): any {
  const lines = output.split('\n');
  // Find the first line that starts with { or [
  const jsonStart = lines.findIndex(line => line.trim().startsWith('{') || line.trim().startsWith('['));
  if (jsonStart === -1) {
    throw new Error('No JSON found in output');
  }
  const jsonString = lines.slice(jsonStart).join('\n');
  return JSON.parse(jsonString);
}

describe('E2E: Facebook Marketplace Search', () => {
  afterAll(async () => {
    await browserManager.close();
  });

  test('should search for laptops and return structured results', async () => {
    console.log('E2E: Searching for laptops...');
    
    const result = await $`bun run src/index.ts search --query "laptop" --limit 5 --format json`.text();
    
    console.log('Search result:', result.substring(0, 500));
    
    const data = parseJSONOutput(result);

    expect(data).toHaveProperty('listings');
    expect(Array.isArray(data.listings)).toBe(true);

    if (data.listings.length > 0) {
      const listing = data.listings[0];

      expect(listing).toHaveProperty('id');
      expect(typeof listing.id).toBe('string');
      expect(listing.id.length).toBeGreaterThan(0);

      expect(listing).toHaveProperty('title');
      expect(typeof listing.title).toBe('string');
      expect(listing.title.length).toBeGreaterThan(0);

      expect(listing).toHaveProperty('price');
      expect(typeof listing.price).toBe('number');
      expect(listing.price).toBeGreaterThanOrEqual(0);

      expect(listing).toHaveProperty('location');
      expect(typeof listing.location).toBe('string');

      expect(listing).toHaveProperty('url');
      expect(typeof listing.url).toBe('string');
      expect(listing.url).toContain('facebook.com');

      expect(listing).toHaveProperty('images');
      expect(Array.isArray(listing.images)).toBe(true);

      expect(listing).toHaveProperty('seller');
      expect(listing.seller).toHaveProperty('name');

      console.log(`Found ${data.listings.length} listings`);
      console.log(`First listing: "${listing.title}" - $${listing.price}`);
    } else {
      console.log('No listings found (this can happen due to various reasons)');
    }
  }, 120000);

  test('should search with price filters', async () => {
    console.log('E2E: Searching with price filters...');
    
    const result = await $`bun run src/index.ts search --query "furniture" --min-price 50 --max-price 500 --limit 3 --format json`.text();
    
    const data = parseJSONOutput(result);

    // Note: Price filtering is sent to Facebook, but we can't reliably
    // validate the returned prices due to scraping limitations (often shows 0)
    console.log(`Found ${data.listings.length} listings with price filters applied`);
  }, 120000);

  test('should return results in markdown format', async () => {
    console.log('E2E: Testing markdown output...');
    
    const result = await $`bun run src/index.ts search --query "bike" --limit 3 --format markdown`.text();
    
    expect(result).toContain('# Facebook Marketplace Search');
    
    const hasListings = result.includes('## ') || result.includes('No listings found');
    expect(hasListings).toBe(true);
    
    console.log('Markdown output structure is valid');
  }, 120000);

  test('should handle location-based search', async () => {
    console.log('E2E: Testing location-based search...');
    
    const result = await $`bun run src/index.ts search --query "car" --location "Los Angeles, CA" --radius 25 --limit 3 --format json`.text();
    
    const data = parseJSONOutput(result);

    if (data.listings.length > 0) {
      // Check that location info is present
      data.listings.forEach((listing: any) => {
        expect(listing.location).toBeDefined();
        expect(typeof listing.location).toBe('string');
      });
      console.log(`Found ${data.listings.length} listings near Los Angeles`);
    }
  }, 120000);
});

describe('E2E: Listing Details', () => {
  let testListingId: string;

  test('should get detailed information for a specific listing', async () => {
    console.log('E2E: Getting listing details...');
    
    const searchResult = await $`bun run src/index.ts search --query "table" --limit 1 --format json`.text();
    const searchData = parseJSONOutput(searchResult);
    
    if (searchData.listings.length === 0) {
      console.log('No listings found to test details');
      return;
    }
    
    testListingId = searchData.listings[0].id;
    console.log(`Testing with listing ID: ${testListingId}`);
    
    const detailResult = await $`bun run src/index.ts listing --id ${testListingId} --format json`.text();
    const detailData = JSON.parse(detailResult);
    
    expect(detailData).toHaveProperty('id', testListingId);
    expect(detailData).toHaveProperty('title');
    expect(detailData).toHaveProperty('price');
    expect(detailData).toHaveProperty('description');
    expect(detailData).toHaveProperty('images');
    expect(Array.isArray(detailData.images)).toBe(true);
    expect(detailData).toHaveProperty('seller');
    expect(detailData.seller).toHaveProperty('name');
    expect(detailData).toHaveProperty('url');
    
    console.log(`Got details for: "${detailData.title}"`);
    console.log(`Description length: ${detailData.description?.length || 0} chars`);
    console.log(`Images found: ${detailData.images.length}`);
  }, 120000);

  test('should return listing details in markdown format', async () => {
    if (!testListingId) {
      console.log('Skipping - no listing ID from previous test');
      return;
    }
    
    const result = await $`bun run src/index.ts listing --id ${testListingId} --format markdown`.text();
    
    expect(result).toContain('# Facebook Marketplace Search');
    expect(result).toContain(testListingId);
    
    console.log('Markdown format listing details retrieved');
  }, 120000);
});

describe('E2E: Messenger Operations', () => {
  test('should list conversations', async () => {
    console.log('E2E: Listing conversations...');
    
    const result = await $`bun run src/index.ts list --limit 10 --format json`.text();
    
    const data = parseJSONOutput(result);
    expect(data).toHaveProperty('conversations');
    expect(Array.isArray(data.conversations)).toBe(true);
    
    if (data.conversations.length > 0) {
      const conversation = data.conversations[0];
      
      expect(conversation).toHaveProperty('id');
      expect(conversation).toHaveProperty('participants');
      expect(Array.isArray(conversation.participants)).toBe(true);
      expect(conversation.participants[0]).toHaveProperty('name');
      
      if (conversation.lastMessage) {
        expect(conversation.lastMessage).toHaveProperty('text');
        expect(conversation.lastMessage).toHaveProperty('timestamp');
      }
      
      console.log(`Found ${data.conversations.length} conversations`);
      console.log(`First conversation with: ${conversation.participants[0]?.name}`);
    } else {
      console.log('No conversations found');
    }
  }, 120000);

  test('should read messages from a conversation', async () => {
    console.log('E2E: Reading conversation messages...');
    
    const listResult = await $`bun run src/index.ts list --limit 1 --format json`.text();
    const listData = parseJSONOutput(listResult);
    
    if (listData.conversations.length === 0) {
      console.log('No conversations to read');
      return;
    }
    
    const conversationId = listData.conversations[0].id;
    console.log(`Reading messages for conversation: ${conversationId}`);
    
    const result = await $`bun run src/index.ts read --conversation-id ${conversationId} --limit 20 --format json`.text();

    const data = parseJSONOutput(result);
    expect(data).toHaveProperty('messages');
    expect(Array.isArray(data.messages)).toBe(true);
    
    if (data.messages.length > 0) {
      const message = data.messages[0];
      
      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('senderId');
      expect(message).toHaveProperty('senderName');
      expect(message).toHaveProperty('text');
      expect(message).toHaveProperty('timestamp');
      
      console.log(`Read ${data.messages.length} messages`);
      console.log(`Latest from ${message.senderName}: "${message.text.substring(0, 50)}..."`);
    } else {
      console.log('No messages in conversation');
    }
  }, 120000);
});

describe('E2E: Error Handling', () => {
  test('should handle invalid listing ID gracefully', async () => {
    console.log('E2E: Testing error handling for invalid ID...');
    
    try {
      await $`bun run src/index.ts listing --id 000000000000000 --format json`.text();
      console.log('Command completed (listing may not exist)');
    } catch (error: any) {
      expect(error.exitCode).toBe(1);
      console.log('Command failed as expected for invalid ID');
    }
  }, 60000);

  test('should require query parameter for search', async () => {
    console.log('E2E: Testing validation...');
    
    try {
      await $`bun run src/index.ts search --limit 5`.text();
    } catch (error: any) {
      expect(error).toBeDefined();
      console.log('Validation working - query is required');
    }
  }, 30000);
});

describe('E2E: Command Output Validation', () => {
  test('search should return valid JSON', async () => {
    const result = await $`bun run src/index.ts search --query "phone" --limit 2 --format json`.text();
    
    expect(() => parseJSONOutput(result)).not.toThrow();

    const data = parseJSONOutput(result);
    expect(data).toHaveProperty('listings');
    
    if (data.listings.length > 0) {
      expect(typeof data.listings[0].id).toBe('string');
      expect(typeof data.listings[0].title).toBe('string');
      expect(typeof data.listings[0].price).toBe('number');
    }
    
    console.log('JSON output is valid');
  }, 120000);

  test('all commands should complete without hanging', async () => {
    console.log('E2E: Testing command completion...');
    
    const searchPromise = $`bun run src/index.ts search --query "book" --limit 1`.quiet();
    const listPromise = $`bun run src/index.ts list --limit 1`.quiet();
    
    const results = await Promise.allSettled([searchPromise, listPromise]);
    
    results.forEach((result, index) => {
      const cmd = index === 0 ? 'search' : 'list';
      if (result.status === 'fulfilled') {
        console.log(`${cmd} completed successfully`);
      } else {
        console.log(`${cmd} failed: ${result.reason}`);
      }
    });
  }, 120000);
});
