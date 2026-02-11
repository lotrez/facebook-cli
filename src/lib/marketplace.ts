import { browserManager } from './browser';
import { authManager } from './auth';
import { randomDelay } from './utils';
import logger from './logger';
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
    
    logger.info(`Searching marketplace for: ${options.query}`);
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay();
    
    // Wait for listings to load
    try {
      await page.waitForSelector('[role="main"] a[href*="/marketplace/item/"]', { timeout: 10000 });
    } catch (error) {
      logger.warn('No listings found or page took too long to load');
      return [];
    }
    
    // Scroll to load more listings
    for (let i = 0; i < 3; i++) {
      await browserManager.humanScroll();
    }
    
    // Extract listings using Playwright locators
    logger.debug('Extracting listings...');
    const listings: Listing[] = [];
    
    // Find all listing links
    const links = await page.locator('a[href*="/marketplace/item/"]').all();
    logger.debug(`Found ${links.length} listing links`);
    
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

        // Extract title and location from image alt text (most reliable)
        // Format: "Title dans Location" e.g., "1996 BMW dans Saint-Ouen-de-Mimbré, PDL"
        // Sometimes format is: " dans Location" (no title in search results)
        let title: string | null = null;
        let location = 'Unknown Location';
        
        const img = await link.locator('img').first();
        const imgAlt = await img.getAttribute('alt');
        
        if (imgAlt && imgAlt.includes(' dans ')) {
          const parts = imgAlt.split(' dans ');
          if (parts.length >= 2 && parts[1]) {
            // Extract location (always present)
            location = parts[1].trim();
            
            // Extract title if present (parts[0] will be empty string if no title)
            const possibleTitle = parts[0]?.trim();
            if (possibleTitle) {
              title = possibleTitle;
            }
            // If no title in search results, title remains null
          }
        }
        
        // Fallback: try aria-label if img alt didn't work
        if (title === null) {
          const ariaLabel = await link.getAttribute('aria-label');
          if (ariaLabel && ariaLabel.includes(' dans ')) {
            const parts = ariaLabel.split(' dans ');
            if (parts.length >= 2 && parts[1]) {
              location = parts[1].trim();
              const possibleTitle = parts[0]?.trim();
              if (possibleTitle) {
                title = possibleTitle;
              }
            }
          }
        }
        
        // Last resort: try to extract from link text
        if (title === null) {
          // Try to extract location (pattern: City, REGION)
          const locationMatch = linkText.match(/([\p{L}\s'-]+?,\s*[A-Z]{2,3})(?=\d|\s*K\s*km|$)/u);
          if (locationMatch && locationMatch[1]) {
            location = locationMatch[1].trim();
            
            // Try to extract title from before location
            const locationStart = linkText.indexOf(locationMatch[1]);
            const beforeLocation = linkText.substring(0, locationStart).trim();
            const titleCandidate = beforeLocation.replace(/^[\d\s]+\s*€\s*/g, '').trim();
            if (titleCandidate) {
              title = titleCandidate;
            }
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
        logger.error(e, 'Failed to extract listing');
      }
    }
    
    logger.info(`Extracted ${listings.length} listings`);
    
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
    logger.info(`Fetching listing: ${id}`);
    
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (error) {
      logger.warn('Navigation timeout, continuing anyway...');
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
      logger.error('Listing content not found');
      return null;
    }
    
    // Extract detailed information
    const listing = await page.evaluate(() => {
      // Find title in the main content area, not the first h1 on page
      const mainContent = document.querySelector('[role="main"]') || document.body;
      const titleEl = mainContent.querySelector('h1');
      const title = titleEl?.textContent?.trim() || 'Unknown Item';
      
      // Try to find price - look for euro symbol since we're on French Facebook
      const bodyText = document.body.textContent || '';
      const euroMatch = bodyText.match(/([\d\s]+)\s*€/);
      const price = euroMatch?.[1] ? parseInt(euroMatch[1].replace(/\s/g, ''), 10) : 0;
      
      // Find description - look for longer text blocks in the main content
      const descriptionEl = Array.from(mainContent.querySelectorAll('div')).find(el => {
        const text = el.textContent || '';
        return text.length > 50 && text.length < 500 && 
               !el.querySelector('h1') && 
               !text.includes('€') &&
               text.split(' ').length > 5;
      });
      const description = descriptionEl?.textContent?.trim();
      
      // Find location - look for link with location or pattern City, REGION
      // French regions can be 2-3 uppercase letters
      const locationLink = mainContent.querySelector('a[href*="/marketplace/"]') as HTMLAnchorElement | null;
      let location = 'Unknown Location';
      if (locationLink) {
        const locationText = locationLink.textContent?.trim();
        if (locationText && locationText.match(/[\p{L}\s'-]+,\s*[A-Z]{2,3}/u)) {
          location = locationText;
        }
      }
      
      // Extract images from main content only
      const images = Array.from(mainContent.querySelectorAll('img'))
        .map(img => img.src)
        .filter(src => src && src.includes('fbcdn.net'))
        .slice(0, 5);
      
      // Find seller info - look for profile links with actual names (not "Informations vendeur")
      const sellerLinks = Array.from(mainContent.querySelectorAll('a[href*="/marketplace/profile/"]')) as HTMLAnchorElement[];
      // Filter out links that just say "Informations vendeur(se)"
      const sellerLink = sellerLinks.find(a => {
        const text = a.textContent?.trim() || '';
        return text && text.length > 0 && !text.includes('Informations vendeur');
      });
      
      const sellerName = sellerLink?.textContent?.trim() || 'Unknown Seller';
      const sellerIdMatch = sellerLink?.href.match(/\/marketplace\/profile\/(\d+)/);
      const sellerId = sellerIdMatch ? sellerIdMatch[1] : '';
      
      return {
        title,
        price,
        currency: 'EUR',
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
