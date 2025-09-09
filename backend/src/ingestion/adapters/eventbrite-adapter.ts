import * as cheerio from 'cheerio';
import { BaseAdapter } from './base-adapter';
import { NormalizedHackathon } from '../types/ingestion';

export class EventbriteAdapter extends BaseAdapter {
  public readonly source_id = 'eventbrite';
  public readonly name = 'Eventbrite';
  protected readonly baseUrl = 'https://www.eventbrite.com';

  protected getScrapingPaths(): string[] {
    return [
      '/d/united-states/hackathon',
      '/d/online/hackathon',
      '/d/worldwide/hackathon'
    ];
  }

  async scrape(): Promise<NormalizedHackathon[]> {
    console.log(`[${this.source_id}] Starting scrape...`);
    
    const hackathons: NormalizedHackathon[] = [];
    
    try {
      // Try multiple search paths
      const searchPaths = this.getScrapingPaths();
      
      for (const path of searchPaths) {
        try {
          const url = `${this.baseUrl}${path}`;
          console.log(`[${this.source_id}] Fetching: ${url}`);
          
          const html = await this.httpClient.get(url, this.source_id);
          const $ = cheerio.load(html);
          
          // Try to parse as JSON first (Eventbrite often has embedded JSON)
          const jsonData = this.extractEmbeddedJSON($);
          if (jsonData.length > 0) {
            hackathons.push(...jsonData);
            console.log(`[${this.source_id}] Extracted ${jsonData.length} hackathons from JSON data`);
            continue;
          }
          
          // Parse HTML structure
          const events = this.parseEventbriteHTML($);
          if (events.length > 0) {
            hackathons.push(...events);
            console.log(`[${this.source_id}] Extracted ${events.length} hackathons from HTML`);
          }
          
          // Limit total results
          if (hackathons.length >= 20) break;
          
        } catch (pathError: any) {
          console.warn(`[${this.source_id}] Error processing path ${path}:`, pathError.message);
          continue;
        }
      }
      
      console.log(`[${this.source_id}] Successfully scraped ${hackathons.length} hackathons`);
      return hackathons;
      
    } catch (error) {
      console.error(`[${this.source_id}] Scraping failed:`, error);
      return [];
    }
  }

  private extractEmbeddedJSON($: cheerio.CheerioAPI): NormalizedHackathon[] {
    const hackathons: NormalizedHackathon[] = [];
    
    try {
      // Look for JSON-LD structured data
      $('script[type="application/ld+json"]').each((_, script) => {
        try {
          const jsonText = $(script).html();
          if (jsonText) {
            const data = JSON.parse(jsonText);
            const events = this.parseStructuredData(data);
            hackathons.push(...events);
          }
        } catch (jsonError) {
          // Continue with other scripts
        }
      });
      
      // Look for embedded JavaScript data
      $('script').each((_, script) => {
        try {
          const scriptContent = $(script).html();
          if (scriptContent && scriptContent.includes('window.__SERVER_DATA__')) {
            // Extract Eventbrite's server data
            const dataMatch = scriptContent.match(/window\.__SERVER_DATA__\s*=\s*({.+?});/);
            if (dataMatch) {
              const data = JSON.parse(dataMatch[1]);
              const events = this.parseEventbriteServerData(data);
              hackathons.push(...events);
            }
          }
        } catch (jsError) {
          // Continue with other scripts
        }
      });
      
    } catch (error) {
      console.warn(`[${this.source_id}] Error extracting embedded JSON:`, error);
    }
    
    return hackathons;
  }

  private parseEventbriteHTML($: cheerio.CheerioAPI): NormalizedHackathon[] {
    const hackathons: NormalizedHackathon[] = [];
    
    try {
      // Eventbrite uses various selectors for event cards
      const eventSelectors = [
        '[data-testid="organizer-profile-event-card"]',
        '.event-card',
        '.search-event-card',
        '[data-event-id]',
        '.eds-event-card',
        '.event-listing',
        'article[data-event]'
      ];
      
      for (const selector of eventSelectors) {
        const eventCards = $(selector);
        if (eventCards.length > 0) {
          console.log(`[${this.source_id}] Found ${eventCards.length} events with selector: ${selector}`);
          
          eventCards.each((index, element) => {
            if (index >= 15) return false; // Limit per selector
            
            try {
              const hackathon = this.parseEventbriteEvent($, $(element));
              if (hackathon) {
                hackathons.push(hackathon);
              }
            } catch (error) {
              console.warn(`[${this.source_id}] Error parsing event ${index}:`, error);
            }
            return true;
          });
          
          if (hackathons.length > 0) break; // Use first successful selector
        }
      }
      
      // If no structured events found, try generic approach
      if (hackathons.length === 0) {
        console.log(`[${this.source_id}] No structured events found, trying generic approach`);
        
        $('a[href*="/e/"]').each((index, link) => {
          if (index >= 10) return false;
          
          try {
            const $link = $(link);
            const href = $link.attr('href');
            const text = this.cleanText($link.text());
            
            if (href && text && text.toLowerCase().includes('hack')) {
              const hackathon = this.createBasicHackathon(text, href);
              if (hackathon) {
                hackathons.push(hackathon);
              }
            }
          } catch (error) {
            console.warn(`[${this.source_id}] Error parsing link ${index}:`, error);
          }
          return true;
        });
      }
      
    } catch (error) {
      console.warn(`[${this.source_id}] Error parsing HTML:`, error);
    }
    
    return hackathons;
  }

  private parseEventbriteEvent($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>): NormalizedHackathon | null {
    try {
      // Extract title
      let title = '';
      const titleSelectors = [
        'h1', 'h2', 'h3', 'h4',
        '.event-title', '.card-title', '.listing-hero-title',
        '[data-testid="event-title"]',
        'a[href*="/e/"]'
      ];
      
      for (const selector of titleSelectors) {
        const titleElement = element.find(selector).first();
        if (titleElement.length) {
          title = this.cleanText(titleElement.text());
          if (title && title.length > 3) break;
        }
      }
      
      if (!title) {
        const linkText = this.cleanText(element.find('a').first().text());
        if (linkText) title = linkText;
      }
      
      if (!title || title.length < 3) {
        return null;
      }
      
      // Extract URL
      let url = '';
      const linkElement = element.find('a[href*="/e/"]').first();
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
      let dates = null;
      const dateSelectors = [
        '.event-date', '.date-time', '.card-date',
        '[data-testid="event-date"]',
        'time', '.date'
      ];
      
      for (const selector of dateSelectors) {
        const dateElement = element.find(selector);
        if (dateElement.length) {
          const dateText = this.cleanText(dateElement.text());
          const dateTime = dateElement.attr('datetime');
          
          if (dateTime) {
            dates = this.parseDateTimeAttribute(dateTime);
            if (dates) break;
          } else if (dateText) {
            dates = this.parseDateRange(dateText);
            if (dates) break;
          }
        }
      }
      
      // If no dates found, extract from full text
      if (!dates) {
        const fullText = this.cleanText(element.text());
        dates = this.extractDatesFromText(fullText);
      }
      
      // Use placeholder dates if none found
      if (!dates) {
        const now = new Date();
        const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        dates = {
          start_date: this.normalizeDate(now.toISOString()),
          end_date: this.normalizeDate(future.toISOString())
        };
      }
      
      // Extract location
      let location = 'Online';
      let isOnline = true;
      
      const locationSelectors = [
        '.event-location', '.location', '.venue',
        '[data-testid="event-location"]',
        '.card-location'
      ];
      
      for (const selector of locationSelectors) {
        const locationText = this.cleanText(element.find(selector).text());
        if (locationText) {
          location = locationText;
          isOnline = this.isOnlineEvent(locationText);
          break;
        }
      }
      
      // Extract description
      let description = '';
      const descSelectors = [
        '.event-description', '.description', '.summary',
        '.card-description', 'p'
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
        source: 'eventbrite',
      };
      
      this.validateHackathon(hackathon);
      return hackathon;
      
    } catch (error) {
      console.warn(`[${this.source_id}] Error parsing Eventbrite event:`, error);
      return null;
    }
  }

  private parseStructuredData(data: any): NormalizedHackathon[] {
    const hackathons: NormalizedHackathon[] = [];
    
    try {
      const events = Array.isArray(data) ? data : [data];
      
      for (const event of events) {
        if (event['@type'] === 'Event') {
          const title = event.name;
          const description = event.description;
          const url = event.url;
          const startDate = event.startDate;
          const endDate = event.endDate;
          const location = event.location?.name || event.location?.address?.addressLocality || 'Online';
          
          if (title && url && startDate && endDate) {
            hackathons.push({
              title: this.cleanText(title),
              description: description ? this.cleanText(description) : undefined,
              start_date: this.normalizeDate(startDate),
              end_date: this.normalizeDate(endDate),
              location: this.cleanText(location),
              is_online: this.isOnlineEvent(location),
              website_url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
              source: 'eventbrite',
            });
          }
        }
      }
    } catch (error) {
      console.warn(`[${this.source_id}] Error parsing structured data:`, error);
    }
    
    return hackathons;
  }

  private parseEventbriteServerData(data: any): NormalizedHackathon[] {
    const hackathons: NormalizedHackathon[] = [];
    
    try {
      // Navigate through Eventbrite's data structure
      const searchResults = data?.search_results?.events || 
                           data?.events || 
                           data?.results?.events || 
                           [];
      
      if (Array.isArray(searchResults)) {
        for (const event of searchResults.slice(0, 10)) {
          try {
            const title = event.name?.text || event.title;
            const description = event.description?.text || event.summary;
            const url = event.url;
            const startDate = event.start?.utc || event.start_date;
            const endDate = event.end?.utc || event.end_date;
            const venue = event.venue;
            const location = venue?.name || venue?.address?.localized_area_display || 'Online';
            
            if (title && url && startDate && endDate) {
              hackathons.push({
                title: this.cleanText(title),
                description: description ? this.cleanText(description) : undefined,
                start_date: this.normalizeDate(startDate),
                end_date: this.normalizeDate(endDate),
                location: this.cleanText(location),
                is_online: this.isOnlineEvent(location) || !venue,
                website_url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
                source: 'eventbrite',
              });
            }
          } catch (eventError) {
            console.warn(`[${this.source_id}] Error parsing server data event:`, eventError);
          }
        }
      }
    } catch (error) {
      console.warn(`[${this.source_id}] Error parsing server data:`, error);
    }
    
    return hackathons;
  }

  private createBasicHackathon(title: string, href: string): NormalizedHackathon | null {
    try {
      const url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
      const now = new Date();
      const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      return {
        title: this.cleanText(title),
        start_date: this.normalizeDate(now.toISOString()),
        end_date: this.normalizeDate(future.toISOString()),
        location: 'Online',
        is_online: true,
        website_url: url,
        source: 'eventbrite',
      };
    } catch (error) {
      return null;
    }
  }

  private parseDateTimeAttribute(datetime: string): { start_date: string; end_date: string } | null {
    try {
      const startDate = new Date(datetime);
      const endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000); // Assume 2-day event
      
      return {
        start_date: this.normalizeDate(startDate.toISOString()),
        end_date: this.normalizeDate(endDate.toISOString())
      };
    } catch (error) {
      return null;
    }
  }

  private parseDateRange(dateText: string): { start_date: string; end_date: string } | null {
    try {
      // Handle various date formats
      const cleanedText = dateText.replace(/\s+/g, ' ').trim();
      
      // "Mar 15, 2024" format
      const singleDateMatch = cleanedText.match(/(\w{3,})\s+(\d{1,2}),?\s*(\d{4})/);
      if (singleDateMatch) {
        const [, month, day, year] = singleDateMatch;
        const startDate = new Date(`${month} ${day}, ${year}`);
        const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // Next day
        
        return {
          start_date: this.normalizeDate(startDate.toISOString()),
          end_date: this.normalizeDate(endDate.toISOString())
        };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private extractDatesFromText(text: string): { start_date: string; end_date: string } | null {
    try {
      // Look for date patterns in text
      const datePatterns = [
        /(\w{3,}\s+\d{1,2}[-–]\d{1,2},?\s*\d{4})/g,
        /(\w{3,}\s+\d{1,2},?\s*\d{4})/g,
        /(\d{1,2}\/\d{1,2}\/\d{4})/g
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

  private isOnlineEvent(locationText: string): boolean {
    const text = locationText.toLowerCase();
    const onlineKeywords = ['online', 'virtual', 'remote', 'digital', 'web', 'internet'];
    return onlineKeywords.some(keyword => text.includes(keyword));
  }
}
