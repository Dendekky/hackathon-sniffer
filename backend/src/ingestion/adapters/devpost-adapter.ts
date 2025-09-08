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
    return ['/hackathons', '/hackathons/open'];
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
        '/hackathons/open',
        '/api/hackathons', // API endpoint possibility
        '/challenges' // Alternative naming
      ];
      
      for (const endpoint of endpoints) {
        try {
          const url = `${this.baseUrl}${endpoint}`;
          console.log(`[${this.source_id}] Trying endpoint: ${url}`);
          
          const html = await this.httpClient.get(url, this.source_id);
          const $ = cheerio.load(html);
          
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
          
          // Try to find any links that look like hackathons
          const hackathonLinks = this.extractHackathonLinks($);
          if (hackathonLinks.length > 0) {
            console.log(`[${this.source_id}] Found ${hackathonLinks.length} potential hackathon links`);
            
            // Process a subset of links to avoid overwhelming the system
            for (const link of hackathonLinks.slice(0, 10)) {
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

  private async parseHackathonElement($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>): Promise<NormalizedHackathon | null> {
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

  private async parseHackathonCard(_$: cheerio.CheerioAPI, card: cheerio.Cheerio<any>): Promise<NormalizedHackathon | null> {
    try {
      // Extract basic info
      const titleElement = card.find('.challenge-title a');
      const title = this.cleanText(titleElement.text());
      const relativeUrl = titleElement.attr('href');
      
      if (!title || !relativeUrl) {
        console.warn(`[${this.source_id}] Skipping card with missing title or URL`);
        return null;
      }

      const website_url = `${this.baseUrl}${relativeUrl}`;

      // Extract dates
      const dateText = this.cleanText(card.find('.challenge-date').text());
      const dates = this.parseDateRange(dateText);
      
      if (!dates) {
        console.warn(`[${this.source_id}] Skipping card with unparseable dates: ${dateText}`);
        return null;
      }

      // Extract location info
      const locationElement = card.find('.challenge-location');
      const locationText = this.cleanText(locationElement.text());
      const { location, is_online } = this.parseLocation(locationText);

      // Extract description (if available on card)
      const description = this.cleanText(card.find('.challenge-description').text()) || undefined;

      // Extract prize/theme info for additional context
      const prizeText = this.cleanText(card.find('.challenge-prize').text());

      const hackathon: NormalizedHackathon = {
        title,
        description: description || (prizeText ? `Prize: ${prizeText}` : undefined),
        start_date: dates.start_date,
        end_date: dates.end_date,
        location,
        is_online,
        website_url,
        source: 'devpost',
      };

      // Try to get more details from the individual hackathon page
      try {
        const detailedInfo = await this.getHackathonDetails(website_url);
        Object.assign(hackathon, detailedInfo);
      } catch (error) {
        console.warn(`[${this.source_id}] Could not fetch details for ${website_url}:`, error);
        // Continue with basic info
      }

      this.validateHackathon(hackathon);
      return hackathon;

    } catch (error) {
      console.error(`[${this.source_id}] Error parsing hackathon card:`, error);
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
      // Handle different JSON structures
      let items: any[] = [];
      
      if (Array.isArray(data)) {
        items = data;
      } else if (data.hackathons && Array.isArray(data.hackathons)) {
        items = data.hackathons;
      } else if (data.challenges && Array.isArray(data.challenges)) {
        items = data.challenges;
      } else if (data.events && Array.isArray(data.events)) {
        items = data.events;
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
      const title = item.title || item.name || item.challenge_title;
      const description = item.description || item.summary;
      const url = item.url || item.link || item.website_url;
      
      if (!title || !url) {
        return null;
      }
      
      // Parse dates
      const startDate = item.start_date || item.startDate || item.begins_at;
      const endDate = item.end_date || item.endDate || item.ends_at;
      
      if (!startDate || !endDate) {
        return null;
      }
      
      const location = item.location || 'Online';
      const isOnline = item.is_online || item.virtual || location.toLowerCase().includes('online');
      
      return {
        title: this.cleanText(title),
        description: description ? this.cleanText(description) : undefined,
        start_date: this.normalizeDate(startDate),
        end_date: this.normalizeDate(endDate),
        location: this.cleanText(location),
        is_online: Boolean(isOnline),
        website_url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
        source: 'devpost',
      };
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
      $('a[href*="/hackathons/"], a[href*="/challenges/"]').each((_, link) => {
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
