import * as cheerio from 'cheerio';
import { BaseAdapter } from './base-adapter';
import { NormalizedHackathon } from '../types/ingestion';

export class DevpostAdapter extends BaseAdapter {
  public readonly source_id = 'devpost';
  public readonly name = 'Devpost';
  protected readonly baseUrl = 'https://devpost.com';

  protected getScrapingPaths(): string[] {
    return ['/hackathons', '/hackathons/open'];
  }

  async scrape(): Promise<NormalizedHackathon[]> {
    console.log(`[${this.source_id}] Starting scrape...`);
    
    const hackathons: NormalizedHackathon[] = [];
    
    try {
      // Scrape the main hackathons page
      const listingUrl = `${this.baseUrl}/hackathons`;
      const html = await this.httpClient.get(listingUrl, this.source_id);
      const $ = cheerio.load(html);

      // Find hackathon cards
      const hackathonCards = $('.challenge-card');
      console.log(`[${this.source_id}] Found ${hackathonCards.length} hackathon cards`);

      for (let i = 0; i < hackathonCards.length; i++) {
        try {
          const card = $(hackathonCards[i]);
          const hackathon = await this.parseHackathonCard($, card);
          
          if (hackathon) {
            hackathons.push(hackathon);
          }
        } catch (error) {
          console.error(`[${this.source_id}] Error parsing card ${i}:`, error);
          // Continue with next card
        }
      }

      console.log(`[${this.source_id}] Successfully scraped ${hackathons.length} hackathons`);
      return hackathons;

    } catch (error) {
      this.handleError(error, 'Failed to scrape Devpost');
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
}
