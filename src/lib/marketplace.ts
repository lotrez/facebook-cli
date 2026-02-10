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
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
    
    // Extract listings using Playwright locators
    console.error('Extracting listings...');
    const listings: Listing[] = [];
    
    // Find all listing links
    const links = await page.locator('a[href*="/marketplace/item/"]').all();
    console.error(`Found ${links.length} listing links`);
    
    for (const link of links.slice(0, options.limit || 20)) {
      try {
        const href = await link.getAttribute('href') || '';
        const match = href.match(/\/marketplace\/item\/(\d+)/);
        if (!match || !match[1]) continue;

        const id: string = match[1];
        
        // Get the link text which contains all info: "Price Title Location KM"
        const linkText = await link.textContent() || '';

        // Try to extract price (number followed by €)
        const priceMatch = linkText.match(/([\d\s]+)\s*€/);
        let price = 0;
        if (priceMatch && priceMatch[1]) {
          const priceStr = priceMatch[1].replace(/\s/g, '');
          const parsedPrice = parseInt(priceStr, 10);
          if (!isNaN(parsedPrice)) {
            price = parsedPrice;
          }
        }

        // Try to extract location (pattern: City, REGION)
        const locationMatch = linkText.match(/([A-Z][^\d]+?[a-z]+,\s*[A-Z]{2,})/);
        let location = 'Unknown Location';
        if (locationMatch && locationMatch[1]) {
          location = locationMatch[1].trim();
        }

        // Extract title - everything between first price and location
        let title = 'Unknown Item';
        if (priceMatch?.[0] && locationMatch?.[1]) {
          const priceEnd = linkText.indexOf(priceMatch[0]) + priceMatch[0].length;
          const locationStart = linkText.indexOf(locationMatch[1]);
          if (priceEnd < locationStart) {
            let rawTitle = linkText.substring(priceEnd, locationStart).trim();
            // Remove any additional price that might be in the title (old crossed-out price)
            rawTitle = rawTitle.replace(/[\d\s]+\s*€\s*/, '');
            title = rawTitle || 'Unknown Item';
          }
        }

        // Fallback: if no title extracted, try aria-label
        if (title === 'Unknown Item') {
          const ariaLabel = await link.getAttribute('aria-label');
          if (ariaLabel) {
            const parts = ariaLabel.split(' dans ');
            if (parts.length > 0 && parts[0]) {
              title = parts[0].trim();
            }
          }
        }
        
        // Fallback: try to get from link text if we couldn't extract properly
        if (title === 'Unknown Item' || price === 0) {
          const fullText = await link.textContent() || '';
          
          // Try to extract price from full text
          const priceMatch = fullText.match(/([\d\s]+)\s*€/);
          if (priceMatch && priceMatch[1] && price === 0) {
            const priceStr = priceMatch[1].replace(/\s/g, '');
            const parsedPrice = parseInt(priceStr, 10);
            if (!isNaN(parsedPrice)) price = parsedPrice;
          }
          
          // Try to get title from aria-label or text
          const ariaLabel = await link.getAttribute('aria-label');
          if (ariaLabel && title === 'Unknown Item') {
            const parts = ariaLabel.split('dans');
            const extractedTitle = parts[0]?.trim();
            title = extractedTitle || ariaLabel || 'Unknown Item';
          }
        }

        listings.push({
          id,
          title: title as string,
          price,
          currency: 'EUR',
          location,
          images: [],
          seller: { id: '', name: 'Unknown' },
          url: `https://facebook.com${href.split('?')[0]}`,
          postedAt: new Date(),
        });
      } catch (e) {
        console.error('Failed to extract listing:', e);
      }
    }
    
    console.error(`Extracted ${listings.length} listings`);
    
    // Remove duplicates
    const uniqueListings = listings.filter((listing, index, self) => 
      index === self.findIndex(l => l.id === listing.id)
    );
    
    return uniqueListings.slice(0, options.limit || 20);
  }

  async getListing(id: string): Promise<Listing | null> {
    await authManager.ensureLoggedIn();
    const page = browserManager.getPage();
    
    const url = `https://www.facebook.com/marketplace/item/${id}`;
    console.error(`Fetching listing: ${id}`);
    
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (error) {
      console.error('Navigation timeout, continuing anyway...');
    }
    await randomDelay();
    
    // Wait for content to load - use a more lenient approach
    let contentFound = false;
    for (let i = 0; i < 3; i++) {
      const hasTitle = await page.locator('h1').count() > 0;
      const hasContent = await page.locator('[role="main"], div[role="dialog"]').count() > 0;
      
      if (hasTitle || hasContent) {
        contentFound = true;
        break;
      }
      
      await randomDelay();
    }
    
    if (!contentFound) {
      console.error('Listing content not found');
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
