import * as cheerio from 'cheerio';
import { chromium, Browser, Page } from 'playwright';
import { BaseAdapter } from './base-adapter';
import { NormalizedHackathon } from '../types/ingestion';

export class DevpostAdapter extends BaseAdapter {
  public readonly source_id = 'devpost';
  public readonly name = 'Devpost';
  protected readonly baseUrl = 'https://devpost.com';
  private browser: Browser | null = null;

  protected getScrapingPaths(): string[] {
    return ['/hackathons'];
  }

  async scrape(): Promise<NormalizedHackathon[]> {
    console.log(`[${this.source_id}] Starting scrape...`);
    
    // Try browser automation first, fall back to HTTP-only approach
    try {
      return await this.scrapeWithBrowser();
    } catch (browserError: any) {
      console.warn(`[${this.source_id}] Browser automation failed, falling back to HTTP-only approach:`, browserError.message);
      return await this.scrapeWithHttp();
    }
  }

  private async scrapeWithBrowser(): Promise<NormalizedHackathon[]> {
    console.log(`[${this.source_id}] Attempting browser automation...`);
    
    const hackathons: NormalizedHackathon[] = [];
    
    try {
      // Launch browser
      this.browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await this.browser.newPage();
      
      // Set user agent to avoid bot detection
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });
      
      // Navigate to hackathons page
      const listingUrl = `${this.baseUrl}/hackathons`;
      console.log(`[${this.source_id}] Navigating to ${listingUrl}...`);
      
      await page.goto(listingUrl, { waitUntil: 'networkidle' });
      
      // Wait for content to load - try multiple selectors
      const possibleSelectors = [
        '[data-testid="challenge-tile"]',
        '.challenge-tile',
        '.hackathon-tile', 
        '.challenge-card',
        '[class*="challenge"]',
        '[class*="hackathon"]',
        'a[href*="/hackathons/"]'
      ];
      
      let contentSelector = null;
      for (const selector of possibleSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          const count = await page.locator(selector).count();
          if (count > 0) {
            contentSelector = selector;
            console.log(`[${this.source_id}] Found ${count} elements with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue trying other selectors
        }
      }
      
      if (!contentSelector) {
        console.log(`[${this.source_id}] No hackathon content found, trying alternative approach...`);
        await this.debugPageContent(page);
        return hackathons;
      }
      
      // Get the page HTML after JavaScript execution
      const html = await page.content();
      const $ = cheerio.load(html);
      
      // Find hackathon elements using the working selector
      const hackathonElements = $(contentSelector);
      console.log(`[${this.source_id}] Found ${hackathonElements.length} hackathon elements`);

      for (let i = 0; i < hackathonElements.length && i < 50; i++) { // Limit to 50 for performance
        try {
          const element = $(hackathonElements[i]);
          const hackathon = await this.parseHackathonElement($, element);
          
          if (hackathon) {
            hackathons.push(hackathon);
          }
        } catch (error) {
          console.error(`[${this.source_id}] Error parsing element ${i}:`, error);
          // Continue with next element
        }
      }

      console.log(`[${this.source_id}] Successfully scraped ${hackathons.length} hackathons`);
      return hackathons;

    } catch (error) {
      throw error; // Re-throw to trigger fallback
    } finally {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    }
  }

  private async scrapeWithHttp(): Promise<NormalizedHackathon[]> {
    console.log(`[${this.source_id}] Using HTTP-only approach...`);
    
    const hackathons: NormalizedHackathon[] = [];
    
    try {
      // Try multiple endpoints that might contain hackathon data
      const endpoints = [
        '/hackathons',
        '/api/hackathons', // API endpoint possibility
        '/software-competitions',
        '/virtual-hackathons'
      ];
      
      for (const endpoint of endpoints) {
        try {
          const url = `${this.baseUrl}${endpoint}`;
          console.log(`[${this.source_id}] Trying endpoint: ${url}`);
          
          const html = await this.httpClient.get(url, this.source_id);
          const $ = cheerio.load(html);
          
          // For API endpoints, try to parse as JSON directly
          if (endpoint.includes('/api/')) {
            try {
              console.log(`[${this.source_id}] Attempting to parse API response as JSON`);
              const jsonData = JSON.parse(html);
              const extractedHackathons = this.extractHackathonsFromJson(jsonData);
              if (extractedHackathons.length > 0) {
                hackathons.push(...extractedHackathons);
                console.log(`[${this.source_id}] Successfully extracted ${extractedHackathons.length} hackathons from API JSON`);
                break;
              }
            } catch (jsonError) {
              console.log(`[${this.source_id}] API response is not valid JSON, trying HTML parsing`);
            }
          }
          
          // Try to find JSON data embedded in the page
          const jsonScripts = $('script[type="application/json"]');
          let foundData = false;
          
          jsonScripts.each((_, script) => {
            try {
              const jsonText = $(script).html();
              if (jsonText && (jsonText.includes('hackathon') || jsonText.includes('challenge'))) {
                console.log(`[${this.source_id}] Found potential JSON data in script tag`);
                const data = JSON.parse(jsonText);
                const extractedHackathons = this.extractHackathonsFromJson(data);
                hackathons.push(...extractedHackathons);
                foundData = true;
              }
            } catch (jsonError) {
              // Continue trying other scripts
            }
          });
          
          if (foundData) {
            console.log(`[${this.source_id}] Successfully extracted ${hackathons.length} hackathons from JSON`);
            break;
          }
          
          // Try to find structured data or meta tags
          const structuredData = this.extractStructuredData($);
          if (structuredData.length > 0) {
            hackathons.push(...structuredData);
            console.log(`[${this.source_id}] Extracted ${structuredData.length} hackathons from structured data`);
            break;
          }
          
          // Try parsing with modern Devpost selectors
          const modernHackathons = this.parseModernDevpostPage($);
          if (modernHackathons.length > 0) {
            hackathons.push(...modernHackathons);
            console.log(`[${this.source_id}] Extracted ${modernHackathons.length} hackathons from modern page structure`);
            break;
          }
          
          // Debug: Log some info about the page structure
          console.log(`[${this.source_id}] Page title: ${$('title').text().substring(0, 100)}`);
          console.log(`[${this.source_id}] Total links found: ${$('a').length}`);
          console.log(`[${this.source_id}] Links with "hackathon" in href: ${$('a[href*="hackathon"]').length}`);
          console.log(`[${this.source_id}] Links with "software" in href: ${$('a[href*="software"]').length}`);
          
          // Try to find any links that look like hackathons
          const hackathonLinks = this.extractHackathonLinks($);
          if (hackathonLinks.length > 0) {
            console.log(`[${this.source_id}] Found ${hackathonLinks.length} potential hackathon links`);
            
            // Process a subset of links to avoid overwhelming the system
            for (const link of hackathonLinks.slice(0, 5)) {
              try {
                const hackathon = await this.processHackathonLink(link);
                if (hackathon) {
                  hackathons.push(hackathon);
                }
              } catch (linkError: any) {
                console.warn(`[${this.source_id}] Error processing link ${link}:`, linkError.message);
              }
            }
            break;
          }
          
        } catch (endpointError: any) {
          console.warn(`[${this.source_id}] Failed to fetch ${endpoint}:`, endpointError.message);
          continue;
        }
      }
      
      console.log(`[${this.source_id}] HTTP-only approach found ${hackathons.length} hackathons`);
      return hackathons;
      
    } catch (error) {
      console.error(`[${this.source_id}] HTTP-only approach failed:`, error);
      return []; // Return empty array instead of throwing
    }
  }

  private async debugPageContent(page: Page): Promise<void> {
    try {
      console.log(`[${this.source_id}] Debugging page content...`);
      
      // Get all links that might be hackathons
      const links = await page.locator('a').all();
      let hackathonLinks = 0;
      
      for (const link of links.slice(0, 20)) { // Check first 20 links
        const href = await link.getAttribute('href');
        const text = await link.textContent();
        if (href && (href.includes('/hackathons/') || href.includes('/challenges/'))) {
          hackathonLinks++;
          console.log(`[${this.source_id}] Found link: ${href} - "${text?.substring(0, 50)}"`);
        }
      }
      
      if (hackathonLinks === 0) {
        console.log(`[${this.source_id}] No hackathon links found. Page might require authentication or have changed structure.`);
      }
    } catch (error) {
      console.error(`[${this.source_id}] Error debugging page:`, error);
    }
  }

  private async parseHackathonElement(_$: cheerio.CheerioAPI, element: cheerio.Cheerio<any>): Promise<NormalizedHackathon | null> {
    try {
      // Try multiple approaches to extract hackathon data
      
      // Approach 1: Look for link in the element
      let titleElement = element.find('a').first();
      if (!titleElement.length) {
        titleElement = element.is('a') ? element : element.find('[href*="/hackathons/"]').first();
      }
      
      const title = this.cleanText(titleElement.text() || element.text());
      const relativeUrl = titleElement.attr('href');
      
      if (!title || !relativeUrl) {
        console.warn(`[${this.source_id}] Skipping element with missing title or URL`);
        return null;
      }

      const website_url = relativeUrl.startsWith('http') ? relativeUrl : `${this.baseUrl}${relativeUrl}`;

      // Extract dates - look in various places
      const dateSelectors = ['.date', '.challenge-date', '[class*="date"]', 'time'];
      let dates = null;
      
      for (const selector of dateSelectors) {
        const dateText = this.cleanText(element.find(selector).text());
        if (dateText) {
          dates = this.parseDateRange(dateText);
          if (dates) break;
        }
      }
      
      // If no dates found, try to extract from text content
      if (!dates) {
        const fullText = this.cleanText(element.text());
        const dateMatch = fullText.match(/(\w{3,}\s+\d{1,2}(?:\s*[-–]\s*\d{1,2})?,?\s*\d{4})/);
        if (dateMatch) {
          dates = this.parseDateRange(dateMatch[1]);
        }
      }
      
      if (!dates) {
        console.warn(`[${this.source_id}] Skipping element with unparseable dates`);
        return null;
      }

      // Extract location info
      const locationSelectors = ['.location', '.challenge-location', '[class*="location"]'];
      let locationText = '';
      
      for (const selector of locationSelectors) {
        locationText = this.cleanText(element.find(selector).text());
        if (locationText) break;
      }
      
      const { location, is_online } = this.parseLocation(locationText || 'Online');

      // Extract description
      const descriptionSelectors = ['.description', '.challenge-description', 'p'];
      let description = '';
      
      for (const selector of descriptionSelectors) {
        description = this.cleanText(element.find(selector).text());
        if (description && description.length > 20) break;
      }

      const hackathon: NormalizedHackathon = {
        title,
        description: description || undefined,
        start_date: dates.start_date,
        end_date: dates.end_date,
        location,
        is_online,
        website_url,
        source: 'devpost',
      };

      this.validateHackathon(hackathon);
      return hackathon;

    } catch (error) {
      console.error(`[${this.source_id}] Error parsing hackathon element:`, error);
      return null;
    }
  }


  private async getHackathonDetails(url: string): Promise<Partial<NormalizedHackathon>> {
    try {
      const html = await this.httpClient.get(url, this.source_id);
      const $ = cheerio.load(html);

      const details: Partial<NormalizedHackathon> = {};

      // Get detailed description
      const descriptionElement = $('.challenge-description, .challenge-details');
      if (descriptionElement.length) {
        details.description = this.cleanText(descriptionElement.first().text());
      }

      // Look for registration URL
      const registerLink = $('a[href*="register"], a[href*="apply"], .register-btn').first();
      if (registerLink.length) {
        const href = registerLink.attr('href');
        if (href) {
          details.registration_url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        }
      }

      // Look for submission deadline
      const deadlineText = $('.submission-deadline, .deadline').text();
      if (deadlineText) {
        try {
          const deadline = this.parseDeadline(deadlineText);
          if (deadline) {
            details.registration_deadline = deadline;
          }
        } catch (error) {
          console.warn(`[${this.source_id}] Could not parse deadline: ${deadlineText}`);
        }
      }

      return details;

    } catch (error) {
      console.warn(`[${this.source_id}] Error fetching hackathon details:`, error);
      return {};
    }
  }

  private parseDateRange(dateText: string): { start_date: string; end_date: string } | null {
    try {
      // Common Devpost date formats:
      // "Oct 15 - 17, 2024"
      // "October 15-17, 2024"
      // "Oct 15, 2024 - Oct 17, 2024"
      
      const cleanedText = dateText.replace(/\s+/g, ' ').trim();
      
      // Try to extract year
      const yearMatch = cleanedText.match(/\b(20\d{2})\b/);
      const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

      // Pattern 1: "Oct 15 - 17, 2024"
      let match = cleanedText.match(/(\w{3,})\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s*(\d{4})?/);
      if (match) {
        const [, month, startDay, endDay, matchedYear] = match;
        const useYear = matchedYear || year;
        
        const startDate = new Date(`${month} ${startDay}, ${useYear}`);
        const endDate = new Date(`${month} ${endDay}, ${useYear}`);
        
        return {
          start_date: this.normalizeDate(startDate.toISOString()),
          end_date: this.normalizeDate(endDate.toISOString()),
        };
      }

      // Pattern 2: "Oct 15, 2024 - Oct 17, 2024"
      match = cleanedText.match(/(\w{3,})\s+(\d{1,2}),?\s*(\d{4})?\s*[-–]\s*(\w{3,})\s+(\d{1,2}),?\s*(\d{4})?/);
      if (match) {
        const [, startMonth, startDay, startYear, endMonth, endDay, endYear] = match;
        
        const startDate = new Date(`${startMonth} ${startDay}, ${startYear || year}`);
        const endDate = new Date(`${endMonth} ${endDay}, ${endYear || year}`);
        
        return {
          start_date: this.normalizeDate(startDate.toISOString()),
          end_date: this.normalizeDate(endDate.toISOString()),
        };
      }

      console.warn(`[${this.source_id}] Could not parse date format: ${dateText}`);
      return null;

    } catch (error) {
      console.error(`[${this.source_id}] Error parsing date range:`, error);
      return null;
    }
  }

  private parseLocation(locationText: string): { location: string; is_online: boolean } {
    const text = locationText.toLowerCase();
    
    // Check for online indicators
    const onlineKeywords = ['online', 'virtual', 'remote', 'digital'];
    const is_online = onlineKeywords.some(keyword => text.includes(keyword));
    
    // Clean up location text
    let location = locationText.trim();
    if (!location) {
      location = is_online ? 'Online' : 'Location TBD';
    }

    return { location, is_online };
  }

  private parseDeadline(deadlineText: string): string | null {
    try {
      // Look for date patterns in deadline text
      const dateMatch = deadlineText.match(/(\w{3,})\s+(\d{1,2}),?\s*(\d{4})?/);
      if (dateMatch) {
        const [, month, day, year] = dateMatch;
        const useYear = year || new Date().getFullYear().toString();
        const deadline = new Date(`${month} ${day}, ${useYear}`);
        return this.normalizeDate(deadline.toISOString());
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private extractHackathonsFromJson(data: any): NormalizedHackathon[] {
    const hackathons: NormalizedHackathon[] = [];
    
    try {
      console.log(`[${this.source_id}] JSON data type: ${typeof data}, keys: ${Object.keys(data).slice(0, 10).join(', ')}`);
      
      // Handle different JSON structures
      let items: any[] = [];
      
      if (Array.isArray(data)) {
        items = data;
        console.log(`[${this.source_id}] Found array with ${items.length} items`);
      } else if (data.hackathons && Array.isArray(data.hackathons)) {
        items = data.hackathons;
        console.log(`[${this.source_id}] Found hackathons array with ${items.length} items`);
      } else if (data.challenges && Array.isArray(data.challenges)) {
        items = data.challenges;
        console.log(`[${this.source_id}] Found challenges array with ${items.length} items`);
      } else if (data.events && Array.isArray(data.events)) {
        items = data.events;
        console.log(`[${this.source_id}] Found events array with ${items.length} items`);
      } else if (data.data && Array.isArray(data.data)) {
        items = data.data;
        console.log(`[${this.source_id}] Found data array with ${items.length} items`);
      } else if (data.results && Array.isArray(data.results)) {
        items = data.results;
        console.log(`[${this.source_id}] Found results array with ${items.length} items`);
      } else {
        // Try to find arrays in the data structure
        for (const [key, value] of Object.entries(data)) {
          if (Array.isArray(value) && value.length > 0) {
            console.log(`[${this.source_id}] Found potential array at key '${key}' with ${value.length} items`);
            // Check if first item looks like a hackathon
            const firstItem = value[0];
            if (firstItem && typeof firstItem === 'object' && 
                (firstItem.title || firstItem.name || firstItem.challenge_title || 
                 firstItem.url || firstItem.link || firstItem.website_url)) {
              items = value;
              console.log(`[${this.source_id}] Using array from key '${key}' as items`);
              break;
            }
          }
        }
      }
      
      if (items.length === 0) {
        console.log(`[${this.source_id}] No suitable array found in JSON data`);
        return hackathons;
      }
      
      for (const item of items.slice(0, 20)) { // Limit to 20 items
        try {
          const hackathon = this.parseJsonHackathon(item);
          if (hackathon) {
            hackathons.push(hackathon);
          }
        } catch (itemError) {
          console.warn(`[${this.source_id}] Error parsing JSON item:`, itemError);
        }
      }
    } catch (error) {
      console.warn(`[${this.source_id}] Error extracting hackathons from JSON:`, error);
    }
    
    return hackathons;
  }

  private parseJsonHackathon(item: any): NormalizedHackathon | null {
    try {
      console.log(`[${this.source_id}] Parsing JSON item with keys: ${Object.keys(item).join(', ')}`);
      
      const title = item.title || item.name || item.challenge_title || item.displayName;
      const description = item.description || item.summary || item.tagline;
      const url = item.url || item.link || item.website_url || item.href;
      
      if (!title) {
        console.log(`[${this.source_id}] Skipping item - no title found`);
        return null;
      }
      
      if (!url) {
        console.log(`[${this.source_id}] Skipping item - no URL found`);
        return null;
      }
      
      // Parse dates - be more flexible
      let startDate = item.start_date || item.startDate || item.begins_at || item.submission_period_dates?.start || item.open_date;
      let endDate = item.end_date || item.endDate || item.ends_at || item.submission_period_dates?.end || item.close_date;
      
      // If no dates found, try to create reasonable defaults
      if (!startDate || !endDate) {
        const now = new Date();
        const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        startDate = startDate || now.toISOString();
        endDate = endDate || future.toISOString();
        console.log(`[${this.source_id}] Using default dates for item: ${title}`);
      }
      
      const location = item.location || item.venue || 'Online';
      const isOnline = item.is_online || item.virtual || item.remote || 
                      location.toLowerCase().includes('online') || 
                      location.toLowerCase().includes('virtual') ||
                      location.toLowerCase().includes('remote');
      
      const hackathon = {
        title: this.cleanText(title),
        description: description ? this.cleanText(description) : undefined,
        start_date: this.normalizeDate(startDate),
        end_date: this.normalizeDate(endDate),
        location: this.cleanText(location),
        is_online: Boolean(isOnline),
        website_url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
        source: 'devpost',
      };
      
      console.log(`[${this.source_id}] Successfully parsed: ${hackathon.title}`);
      return hackathon;
    } catch (error) {
      console.warn(`[${this.source_id}] Error parsing JSON hackathon:`, error);
      return null;
    }
  }

  private extractStructuredData($: cheerio.CheerioAPI): NormalizedHackathon[] {
    const hackathons: NormalizedHackathon[] = [];
    
    try {
      // Look for JSON-LD structured data
      $('script[type="application/ld+json"]').each((_, script) => {
        try {
          const jsonText = $(script).html();
          if (jsonText) {
            const data = JSON.parse(jsonText);
            if (data['@type'] === 'Event' || (Array.isArray(data) && data.some(item => item['@type'] === 'Event'))) {
              const events = Array.isArray(data) ? data : [data];
              for (const event of events) {
                const hackathon = this.parseStructuredEvent(event);
                if (hackathon) {
                  hackathons.push(hackathon);
                }
              }
            }
          }
        } catch (jsonError) {
          // Continue with other scripts
        }
      });
    } catch (error) {
      console.warn(`[${this.source_id}] Error extracting structured data:`, error);
    }
    
    return hackathons;
  }

  private parseStructuredEvent(event: any): NormalizedHackathon | null {
    try {
      if (event['@type'] !== 'Event') {
        return null;
      }
      
      const title = event.name;
      const description = event.description;
      const url = event.url;
      const startDate = event.startDate;
      const endDate = event.endDate;
      const location = event.location?.name || event.location;
      
      if (!title || !url || !startDate || !endDate) {
        return null;
      }
      
      return {
        title: this.cleanText(title),
        description: description ? this.cleanText(description) : undefined,
        start_date: this.normalizeDate(startDate),
        end_date: this.normalizeDate(endDate),
        location: this.cleanText(location || 'Online'),
        is_online: !location || location.toLowerCase().includes('online'),
        website_url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
        source: 'devpost',
      };
    } catch (error) {
      return null;
    }
  }

  private extractHackathonLinks($: cheerio.CheerioAPI): string[] {
    const links: string[] = [];
    
    try {
      // Look for links that might be hackathons
      $('a[href*="/hackathons/"], a[href*="/challenges/"], a[href*="/software-competitions/"]').each((_, link) => {
        const href = $(link).attr('href');
        if (href && !href.includes('#') && !href.includes('?')) {
          const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          if (!links.includes(fullUrl)) {
            links.push(fullUrl);
          }
        }
      });
    } catch (error) {
      console.warn(`[${this.source_id}] Error extracting hackathon links:`, error);
    }
    
    return links;
  }

  private parseModernDevpostPage($: cheerio.CheerioAPI): NormalizedHackathon[] {
    const hackathons: NormalizedHackathon[] = [];
    
    try {
      // Modern Devpost uses various selectors for hackathon cards
      const possibleSelectors = [
        '.challenge-item',
        '.hackathon-item',
        '.challenge-card',
        '.hackathon-card',
        '[data-testid*="challenge"]',
        '[data-testid*="hackathon"]',
        '.tile',
        '.card',
        'article',
        '.challenge-tile'
      ];
      
      for (const selector of possibleSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          console.log(`[${this.source_id}] Trying selector: ${selector} (${elements.length} elements)`);
          
          elements.each((index, element) => {
            if (index >= 20) return false; // Limit to 20 items per selector
            
            try {
              const $element = $(element);
              const hackathon = this.parseModernHackathonElement($, $element);
              if (hackathon) {
                hackathons.push(hackathon);
              }
            } catch (error) {
              console.warn(`[${this.source_id}] Error parsing element ${index}:`, error);
            }
            return true;
          });
          
          if (hackathons.length > 0) {
            console.log(`[${this.source_id}] Successfully parsed ${hackathons.length} hackathons with selector: ${selector}`);
            break; // Use the first successful selector
          }
        }
      }
      
      // If no structured elements found, try to extract from any links
      if (hackathons.length === 0) {
        console.log(`[${this.source_id}] No structured elements found, trying link-based approach`);
        const links = $('a[href*="/software-competitions/"], a[href*="/hackathons/"], a[href*="/challenges/"]');
        
        links.each((index, link) => {
          if (index >= 10) return false; // Limit to 10 links
          
          try {
            const $link = $(link);
            const href = $link.attr('href');
            const text = this.cleanText($link.text());
            
            if (href && text && text.length > 5) {
              // Create a basic hackathon entry from the link
              const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
              
              // Try to extract date info from surrounding context
              const parent = $link.closest('div, article, section, li');
              const contextText = this.cleanText(parent.text());
              const dateMatch = contextText.match(/(\w{3,}\s+\d{1,2}(?:\s*[-–]\s*\d{1,2})?,?\s*\d{4})/);
              
              if (dateMatch) {
                const dates = this.parseDateRange(dateMatch[1]);
                if (dates) {
                  hackathons.push({
                    title: text,
                    start_date: dates.start_date,
                    end_date: dates.end_date,
                    location: 'Online',
                    is_online: true,
                    website_url: fullUrl,
                    source: 'devpost',
                  });
                }
              }
            }
          } catch (error) {
            console.warn(`[${this.source_id}] Error parsing link ${index}:`, error);
          }
          return true;
        });
      }
    } catch (error) {
      console.warn(`[${this.source_id}] Error in parseModernDevpostPage:`, error);
    }
    
    return hackathons;
  }

  private parseModernHackathonElement(_$: cheerio.CheerioAPI, element: cheerio.Cheerio<any>): NormalizedHackathon | null {
    try {
      // Look for title in various places
      let title = '';
      const titleSelectors = ['h1', 'h2', 'h3', '.title', '.name', 'a', '[data-testid*="title"]'];
      
      for (const selector of titleSelectors) {
        const titleElement = element.find(selector).first();
        if (titleElement.length) {
          title = this.cleanText(titleElement.text());
          if (title && title.length > 3) break;
        }
      }
      
      if (!title) {
        title = this.cleanText(element.text().split('\n')[0]); // Use first line as title
      }
      
      if (!title || title.length < 3) {
        return null;
      }
      
      // Look for URL
      let url = '';
      const linkElement = element.find('a').first();
      if (linkElement.length) {
        const href = linkElement.attr('href');
        if (href) {
          url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        }
      }
      
      if (!url) {
        return null;
      }
      
      // Extract date information from text content
      const fullText = this.cleanText(element.text());
      let dates = null;
      
      // Look for various date patterns
      const datePatterns = [
        /(\w{3,}\s+\d{1,2}(?:\s*[-–]\s*\d{1,2})?,?\s*\d{4})/g,
        /(\d{1,2}\/\d{1,2}\/\d{4})/g,
        /(\d{4}-\d{2}-\d{2})/g
      ];
      
      for (const pattern of datePatterns) {
        const matches = fullText.match(pattern);
        if (matches && matches.length > 0) {
          dates = this.parseDateRange(matches[0]);
          if (dates) break;
        }
      }
      
      // If no dates found, try to infer from current context or use placeholder
      if (!dates) {
        // Use a placeholder date range (current date + 30 days)
        const now = new Date();
        const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        dates = {
          start_date: this.normalizeDate(now.toISOString()),
          end_date: this.normalizeDate(future.toISOString())
        };
      }
      
      // Extract location info
      const locationKeywords = ['online', 'virtual', 'remote', 'in-person', 'hybrid'];
      let location = 'Online';
      let isOnline = true;
      
      const lowerText = fullText.toLowerCase();
      for (const keyword of locationKeywords) {
        if (lowerText.includes(keyword)) {
          location = keyword.charAt(0).toUpperCase() + keyword.slice(1);
          isOnline = ['online', 'virtual', 'remote'].includes(keyword);
          break;
        }
      }
      
      // Extract description (try to get meaningful text)
      let description = '';
      const descriptionSelectors = ['.description', '.summary', 'p'];
      
      for (const selector of descriptionSelectors) {
        const desc = this.cleanText(element.find(selector).text());
        if (desc && desc.length > 20) {
          description = desc.substring(0, 500); // Limit description length
          break;
        }
      }
      
      const hackathon: NormalizedHackathon = {
        title,
        description: description || undefined,
        start_date: dates.start_date,
        end_date: dates.end_date,
        location,
        is_online: isOnline,
        website_url: url,
        source: 'devpost',
      };
      
      this.validateHackathon(hackathon);
      return hackathon;
      
    } catch (error) {
      console.warn(`[${this.source_id}] Error parsing modern hackathon element:`, error);
      return null;
    }
  }

  private async processHackathonLink(url: string): Promise<NormalizedHackathon | null> {
    try {
      const html = await this.httpClient.get(url, this.source_id);
      const $ = cheerio.load(html);
      
      // Extract basic info from the individual page
      const title = this.cleanText($('h1').first().text() || $('title').text());
      if (!title) {
        return null;
      }
      
      // Try to find dates in meta tags or structured data
      let startDate = $('meta[property="event:start_time"]').attr('content');
      let endDate = $('meta[property="event:end_time"]').attr('content');
      
      if (!startDate || !endDate) {
        // Try to find dates in text content
        const pageText = $('body').text();
        const dateMatch = pageText.match(/(\w{3,}\s+\d{1,2}(?:\s*[-–]\s*\d{1,2})?,?\s*\d{4})/);
        if (dateMatch) {
          const dates = this.parseDateRange(dateMatch[1]);
          if (dates) {
            startDate = dates.start_date;
            endDate = dates.end_date;
          }
        }
      }
      
      if (!startDate || !endDate) {
        return null; // Skip if we can't find dates
      }
      
      const description = this.cleanText($('meta[name="description"]').attr('content') || '');
      const location = this.cleanText($('meta[property="event:location"]').attr('content') || 'Online');
      
      return {
        title,
        description: description || undefined,
        start_date: this.normalizeDate(startDate),
        end_date: this.normalizeDate(endDate),
        location,
        is_online: location.toLowerCase().includes('online'),
        website_url: url,
        source: 'devpost',
      };
    } catch (error) {
      console.warn(`[${this.source_id}] Error processing hackathon link ${url}:`, error);
      return null;
    }
  }
}
