import { AdapterInterface, NormalizedHackathon, ScrapingError } from '../types/ingestion';
import { HttpClient } from '../utils/http-client';

export abstract class BaseAdapter implements AdapterInterface {
  protected httpClient: HttpClient;
  public abstract readonly source_id: string;
  public abstract readonly name: string;
  protected abstract readonly baseUrl: string;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  abstract scrape(): Promise<NormalizedHackathon[]>;

  async isRobotsTxtCompliant(): Promise<boolean> {
    try {
      const robotsContent = await this.httpClient.checkRobotsTxt(this.baseUrl);
      
      if (!robotsContent) {
        console.warn(`[${this.source_id}] No robots.txt found, proceeding with caution`);
        return true;
      }

      // Check if our scraping paths are allowed
      const scrapingPaths = this.getScrapingPaths();
      const userAgent = 'HackathonSnifferBot';

      for (const path of scrapingPaths) {
        if (!this.httpClient.isAllowedByRobotsTxt(robotsContent, userAgent, path)) {
          console.error(`[${this.source_id}] Path ${path} is disallowed by robots.txt`);
          return false;
        }
      }

      console.log(`[${this.source_id}] robots.txt compliance check passed`);
      return true;
    } catch (error) {
      console.error(`[${this.source_id}] Error checking robots.txt:`, error);
      return false; // Err on the side of caution
    }
  }

  /**
   * Return the paths this adapter will scrape (for robots.txt checking)
   */
  protected abstract getScrapingPaths(): string[];

  /**
   * Normalize date strings to ISO format
   */
  protected normalizeDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date: ${dateStr}`);
      }
      return date.toISOString();
    } catch (error) {
      throw new ScrapingError(`Failed to normalize date: ${dateStr}`, this.source_id);
    }
  }

  /**
   * Clean and normalize text content
   */
  protected cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();
  }

  /**
   * Extract domain from URL for location fallback
   */
  protected extractDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Validate required fields are present
   */
  protected validateHackathon(data: Partial<NormalizedHackathon>): void {
    const required = ['title', 'start_date', 'end_date', 'location', 'source'];
    const missing = required.filter(field => !data[field as keyof NormalizedHackathon]);
    
    if (missing.length > 0) {
      throw new ScrapingError(
        `Missing required fields: ${missing.join(', ')}`,
        this.source_id
      );
    }

    // Validate dates
    const startDate = new Date(data.start_date!);
    const endDate = new Date(data.end_date!);
    
    if (startDate >= endDate) {
      throw new ScrapingError(
        'Start date must be before end date',
        this.source_id
      );
    }
  }

  /**
   * Handle scraping errors with context
   */
  protected handleError(error: any, context: string, url?: string): never {
    const message = error instanceof Error ? error.message : String(error);
    throw new ScrapingError(
      `${context}: ${message}`,
      this.source_id,
      url,
      error instanceof Error ? error : undefined
    );
  }
}
