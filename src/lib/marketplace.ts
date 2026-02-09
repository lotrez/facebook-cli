import { browserManager } from './browser';
import { authManager } from './auth';
import { randomDelay } from './utils';
import type { Listing, SearchOptions } from '../types';

export class MarketplaceManager {
  async search(options: SearchOptions): Promise<Listing[]> {
    await authManager.ensureLoggedIn();
    const page = browserManager.getPage();
    
    // Build search URL
    let url = 'https://www.facebook.com/marketplace/';
    
    if (options.location) {
      // Need to geocode location or use a search approach
      url += `search/?query=${encodeURIComponent(options.query)}`;
    } else {
      url += `search/?query=${encodeURIComponent(options.query)}`;
    }
    
    console.error(`Searching marketplace for: ${options.query}`);
    
    await page.goto(url, { waitUntil: 'networkidle' });
    await randomDelay();
    
    // Wait for listings to load
    try {
      await page.waitForSelector('[role="main"] a[href*="/marketplace/item/"]', { timeout: 10000 });
    } catch (error) {
      console.error('No listings found or page took too long to load');
      return [];
    }
    
    // Scroll to load more listings
    for (let i = 0; i < 3; i++) {
      await browserManager.humanScroll();
    }
    
    // Extract listings
    const listings = await page.evaluate(() => {
      const items: any[] = [];
      const links = document.querySelectorAll('a[href*="/marketplace/item/"]');
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        const match = href.match(/\/marketplace\/item\/(\d+)/);
        if (!match) return;
        
        const id = match[1];
        
        // Try to extract title and price from the element
        const text = link.textContent || '';
        const priceMatch = text.match(/\$([\d,]+)/);
        const price = priceMatch?.[1] ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 0;
        
        // Extract title - usually the text before price
        let title = text.split('$')[0]?.trim() ?? 'Unknown Item';
        
        // Extract location if available
        const locationMatch = text.match(/·\s*([^·]+)$/);
        const location = locationMatch?.[1]?.trim() ?? 'Unknown Location';
        
        items.push({
          id,
          title,
          price,
          currency: 'USD',
          location,
          images: [],
          seller: { id: '', name: 'Unknown' },
          url: `https://facebook.com${href.split('?')[0]}`,
          postedAt: new Date(),
        });
      });
      
      return items;
    });
    
    // Remove duplicates
    const uniqueListings = listings.filter((listing, index, self) => 
      index === self.findIndex(l => l.id === listing.id)
    );
    
    // Apply limit
    const limit = options.limit || 20;
    return uniqueListings.slice(0, limit) as Listing[];
  }

  async getListing(id: string): Promise<Listing | null> {
    await authManager.ensureLoggedIn();
    const page = browserManager.getPage();
    
    const url = `https://www.facebook.com/marketplace/item/${id}`;
    console.error(`Fetching listing: ${id}`);
    
    await page.goto(url, { waitUntil: 'networkidle' });
    await randomDelay();
    
    // Wait for content to load
    try {
      await page.waitForSelector('h1, [role="main"]', { timeout: 10000 });
    } catch (error) {
      console.error('Listing not found or page took too long to load');
      return null;
    }
    
    // Extract detailed information
    const listing = await page.evaluate(() => {
      const titleEl = document.querySelector('h1');
      const title = titleEl?.textContent?.trim() || 'Unknown Item';
      
      // Try to find price
      const bodyText = document.body.textContent || '';
      const priceMatch = bodyText.match(/\$([\d,]+(?:\.\d{2})?)/);
      const price = priceMatch?.[1] ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
      
      // Find description
      const descriptionEl = Array.from(document.querySelectorAll('div')).find(el => 
        el.textContent && el.textContent.length > 100 && !el.querySelector('h1')
      );
      const description = descriptionEl?.textContent?.trim();
      
      // Find location
      const locationMatch = bodyText.match(/([^,]+,\s*[A-Z]{2})/);
      const location = locationMatch?.[1] ?? 'Unknown Location';
      
      // Extract images
      const images = Array.from(document.querySelectorAll('img'))
        .map(img => img.src)
        .filter(src => src && src.includes('fbcdn.net'))
        .slice(0, 5);
      
      // Find seller info
      const sellerLinks = Array.from(document.querySelectorAll('a'));
      const sellerLink = sellerLinks.find(a => a.href.includes('/marketplace/profile/'));
      const sellerName = sellerLink?.textContent?.trim() || 'Unknown Seller';
      const sellerIdMatch = sellerLink?.href.match(/\/marketplace\/profile\/(\d+)/);
      const sellerId = sellerIdMatch ? sellerIdMatch[1] : '';
      
      return {
        title,
        price,
        currency: 'USD',
        location,
        description,
        images,
        seller: {
          id: sellerId,
          name: sellerName,
        },
      };
    });
    
    return {
      id,
      ...listing,
      url,
      postedAt: new Date(),
    } as Listing;
  }
}

export const marketplaceManager = new MarketplaceManager();
