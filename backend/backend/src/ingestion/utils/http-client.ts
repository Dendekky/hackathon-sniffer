import Bottleneck from 'bottleneck';
import { ScrapingError } from '../types/ingestion';

export interface HttpClientOptions {
  userAgent?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  rateLimitConfig?: {
    maxConcurrent: number;
    minTime: number;
  };
}

export class HttpClient {
  private limiter: Bottleneck;
  private userAgent: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor(options: HttpClientOptions = {}) {
    this.userAgent = options.userAgent || 'HackathonSnifferBot/0.1';
    this.timeout = options.timeout || 15000;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;

    // Set up rate limiting
    const rateLimitConfig = options.rateLimitConfig || {
      maxConcurrent: 3,
      minTime: 1000, // 1 second between requests
    };

    this.limiter = new Bottleneck({
      maxConcurrent: rateLimitConfig.maxConcurrent,
      minTime: rateLimitConfig.minTime,
    });
  }

  async get(url: string, source_id: string): Promise<string> {
    return this.limiter.schedule(() => this.makeRequest(url, source_id));
  }

  private async makeRequest(url: string, source_id: string, attempt = 1): Promise<string> {
    try {
      console.log(`[${source_id}] Fetching: ${url} (attempt ${attempt})`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      console.log(`[${source_id}] Successfully fetched ${text.length} characters from ${url}`);
      
      return text;

    } catch (error) {
      console.error(`[${source_id}] Request failed (attempt ${attempt}):`, error);

      if (attempt < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`[${source_id}] Retrying in ${delay}ms...`);
        
        await this.sleep(delay);
        return this.makeRequest(url, source_id, attempt + 1);
      }

      throw new ScrapingError(
        `Failed to fetch ${url} after ${this.maxRetries} attempts`,
        source_id,
        url,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async checkRobotsTxt(baseUrl: string): Promise<string | null> {
    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).toString();
      const robotsContent = await this.get(robotsUrl, 'robots-check');
      return robotsContent;
    } catch (error) {
      console.warn(`Could not fetch robots.txt for ${baseUrl}:`, error);
      return null;
    }
  }

  isAllowedByRobotsTxt(robotsContent: string | null, userAgent: string, path: string): boolean {
    if (!robotsContent) {
      return true; // If no robots.txt, assume allowed
    }

    const lines = robotsContent.split('\n').map(line => line.trim().toLowerCase());
    let currentUserAgent = '';
    let isRelevantSection = false;
    let disallowed: string[] = [];
    let allowed: string[] = [];

    for (const line of lines) {
      if (line.startsWith('user-agent:')) {
        currentUserAgent = line.substring('user-agent:'.length).trim();
        isRelevantSection = currentUserAgent === '*' || 
                           currentUserAgent === userAgent.toLowerCase() ||
                           userAgent.toLowerCase().includes(currentUserAgent);
        disallowed = [];
        allowed = [];
      } else if (isRelevantSection) {
        if (line.startsWith('disallow:')) {
          const disallowPath = line.substring('disallow:'.length).trim();
          if (disallowPath) {
            disallowed.push(disallowPath);
          }
        } else if (line.startsWith('allow:')) {
          const allowPath = line.substring('allow:'.length).trim();
          if (allowPath) {
            allowed.push(allowPath);
          }
        }
      }
    }

    // Check if path is explicitly allowed
    for (const allowPattern of allowed) {
      if (path.startsWith(allowPattern)) {
        return true;
      }
    }

    // Check if path is disallowed
    for (const disallowPattern of disallowed) {
      if (path.startsWith(disallowPattern)) {
        return false;
      }
    }

    return true; // Default to allowed if not explicitly disallowed
  }

  async close(): Promise<void> {
    await this.limiter.stop({ dropWaitingJobs: false });
  }
}
