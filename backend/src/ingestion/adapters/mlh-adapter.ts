import * as cheerio from 'cheerio';
import { BaseAdapter } from './base-adapter';
import { NormalizedHackathon } from '../types/ingestion';

export class MLHAdapter extends BaseAdapter {
  public readonly source_id = 'mlh';
  public readonly name = 'Major League Hacking';
  protected readonly baseUrl = 'https://mlh.io';

  protected getScrapingPaths(): string[] {
    return ['/seasons/2025/events'];
  }

  async scrape(): Promise<NormalizedHackathon[]> {
    console.log(`[${this.source_id}] Starting scrape...`);
    
    const hackathons: NormalizedHackathon[] = [];
    
    try {
      // Try to scrape from MLH events page
      const url = `${this.baseUrl}/seasons/2025/events`;
      console.log(`[${this.source_id}] Fetching: ${url}`);
      
      const html = await this.httpClient.get(url, this.source_id);
      const $ = cheerio.load(html);
      
      // MLH uses event cards with specific structure
      const eventCards = $('.event-wrapper, .event, .event-card, [class*="event"]');
      console.log(`[${this.source_id}] Found ${eventCards.length} potential event elements`);
      
      if (eventCards.length === 0) {
        // Try alternative selectors
        const alternativeSelectors = [
          'article',
          '.hackathon',
          '[data-event]',
          '.card',
          '.listing'
        ];
        
        for (const selector of alternativeSelectors) {
          const elements = $(selector);
          if (elements.length > 0) {
            console.log(`[${this.source_id}] Trying alternative selector: ${selector} (${elements.length} elements)`);
            
            elements.each((index, element) => {
              if (index >= 20) return false; // Limit to 20 items
              
              try {
                const hackathon = this.parseMLHEvent($, $(element));
                if (hackathon) {
                  hackathons.push(hackathon);
                }
              } catch (error) {
                console.warn(`[${this.source_id}] Error parsing element ${index}:`, error);
              }
              return true;
            });
            
            if (hackathons.length > 0) break;
          }
        }
      } else {
        // Parse standard event cards
        eventCards.each((index, element) => {
          if (index >= 20) return false; // Limit to 20 items
          
          try {
            const hackathon = this.parseMLHEvent($, $(element));
            if (hackathon) {
              hackathons.push(hackathon);
            }
          } catch (error) {
            console.warn(`[${this.source_id}] Error parsing event ${index}:`, error);
          }
          return true;
        });
      }
      
      // If no events found, try to extract from any links
      if (hackathons.length === 0) {
        console.log(`[${this.source_id}] No events found, trying link-based approach`);
        const eventLinks = this.extractEventLinks($);
        
        for (const link of eventLinks.slice(0, 5)) {
          try {
            const hackathon = await this.processEventLink(link);
            if (hackathon) {
              hackathons.push(hackathon);
            }
          } catch (error) {
            console.warn(`[${this.source_id}] Error processing link ${link}:`, error);
          }
        }
      }
      
      console.log(`[${this.source_id}] Successfully scraped ${hackathons.length} hackathons`);
      return hackathons;
      
    } catch (error) {
      console.error(`[${this.source_id}] Scraping failed:`, error);
      return [];
    }
  }

  private parseMLHEvent($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>): NormalizedHackathon | null {
    try {
      // Extract title
      let title = '';
      const titleSelectors = [
        'h1', 'h2', 'h3', 'h4',
        '.title', '.name', '.event-name', '.hackathon-name',
        'a[href*="/events/"]',
        '.event-title'
      ];
      
      for (const selector of titleSelectors) {
        const titleElement = element.find(selector).first();
        if (titleElement.length) {
          title = this.cleanText(titleElement.text());
          if (title && title.length > 3) break;
        }
      }
      
      if (!title) {
        title = this.cleanText(element.text().split('\n')[0]);
      }
      
      if (!title || title.length < 3) {
        return null;
      }
      
      // Extract URL
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
      
      // Extract dates
      const fullText = this.cleanText(element.text());
      let dates = this.extractDatesFromText(fullText);
      
      // If no dates found, use placeholder
      if (!dates) {
        const now = new Date();
        const future = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000); // 45 days from now
        dates = {
          start_date: this.normalizeDate(now.toISOString()),
          end_date: this.normalizeDate(future.toISOString())
        };
      }
      
      // Extract location
      let location = 'Online';
      let isOnline = true;
      
      const locationSelectors = [
        '.location', '.venue', '.place', '.event-location'
      ];
      
      for (const selector of locationSelectors) {
        const locationText = this.cleanText(element.find(selector).text());
        if (locationText) {
          location = locationText;
          isOnline = this.isOnlineEvent(locationText);
          break;
        }
      }
      
      // Check text for location indicators
      if (location === 'Online') {
        const locationMatch = fullText.match(/(?:at|in|@)\s+([^,\n]+)/i);
        if (locationMatch) {
          location = this.cleanText(locationMatch[1]);
          isOnline = this.isOnlineEvent(location);
        }
      }
      
      // Extract description
      let description = '';
      const descSelectors = [
        '.description', '.summary', '.event-description', 'p'
      ];
      
      for (const selector of descSelectors) {
        const desc = this.cleanText(element.find(selector).text());
        if (desc && desc.length > 20) {
          description = desc.substring(0, 500);
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
        source: 'mlh',
      };
      
      this.validateHackathon(hackathon);
      return hackathon;
      
    } catch (error) {
      console.warn(`[${this.source_id}] Error parsing MLH event:`, error);
      return null;
    }
  }

  private extractEventLinks($: cheerio.CheerioAPI): string[] {
    const links: string[] = [];
    
    try {
      // Look for event-related links
      $('a[href*="/events/"], a[href*="hackathon"], a[href*="hack"]').each((_, link) => {
        const href = $(link).attr('href');
        if (href && !href.includes('#') && !href.includes('?')) {
          const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          if (!links.includes(fullUrl)) {
            links.push(fullUrl);
          }
        }
      });
    } catch (error) {
      console.warn(`[${this.source_id}] Error extracting event links:`, error);
    }
    
    return links;
  }

  private async processEventLink(url: string): Promise<NormalizedHackathon | null> {
    try {
      const html = await this.httpClient.get(url, this.source_id);
      const $ = cheerio.load(html);
      
      const title = this.cleanText($('h1').first().text() || $('title').text());
      if (!title) return null;
      
      // Extract dates from page content
      const pageText = $('body').text();
      const dates = this.extractDatesFromText(pageText);
      
      if (!dates) return null;
      
      const description = this.cleanText($('meta[name="description"]').attr('content') || '');
      const location = this.cleanText($('.location, .venue').first().text() || 'Online');
      
      return {
        title,
        description: description || undefined,
        start_date: dates.start_date,
        end_date: dates.end_date,
        location,
        is_online: this.isOnlineEvent(location),
        website_url: url,
        source: 'mlh',
      };
    } catch (error) {
      console.warn(`[${this.source_id}] Error processing event link ${url}:`, error);
      return null;
    }
  }

  private extractDatesFromText(text: string): { start_date: string; end_date: string } | null {
    try {
      // Look for various date patterns
      const datePatterns = [
        // "March 15-17, 2024"
        /(\w{3,}\s+\d{1,2}[-–]\d{1,2},?\s*\d{4})/g,
        // "March 15, 2024 - March 17, 2024"
        /(\w{3,}\s+\d{1,2},?\s*\d{4}\s*[-–]\s*\w{3,}\s+\d{1,2},?\s*\d{4})/g,
        // "2024-03-15 to 2024-03-17"
        /(\d{4}-\d{2}-\d{2}\s+to\s+\d{4}-\d{2}-\d{2})/g,
        // "15/03/2024 - 17/03/2024"
        /(\d{1,2}\/\d{1,2}\/\d{4}\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{4})/g
      ];
      
      for (const pattern of datePatterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
          const dateRange = this.parseDateRange(matches[0]);
          if (dateRange) return dateRange;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private parseDateRange(dateText: string): { start_date: string; end_date: string } | null {
    try {
      const cleanedText = dateText.replace(/\s+/g, ' ').trim();
      
      // Extract year
      const yearMatch = cleanedText.match(/\b(20\d{2})\b/);
      const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

      // Pattern 1: "March 15-17, 2024"
      let match = cleanedText.match(/(\w{3,})\s+(\d{1,2})[-–](\d{1,2}),?\s*(\d{4})?/);
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

      // Pattern 2: "March 15, 2024 - March 17, 2024"
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

      return null;
    } catch (error) {
      return null;
    }
  }

  private isOnlineEvent(locationText: string): boolean {
    const text = locationText.toLowerCase();
    const onlineKeywords = ['online', 'virtual', 'remote', 'digital', 'worldwide', 'global'];
    return onlineKeywords.some(keyword => text.includes(keyword));
  }
}
