import * as cron from 'node-cron';
import { HttpClient } from './utils/http-client';
import { DeduplicationService } from './utils/deduplication';
import { DevpostAdapter } from './adapters/devpost-adapter';
import { NormalizedHackathon, ScrapingResult, AdapterInterface } from './types/ingestion';

// Import database utilities
import { Database } from './db/database';
import { HackathonModel } from './models/hackathon';

export class IngestionScheduler {
  private httpClient: HttpClient;
  private adapters: AdapterInterface[];
  private hackathonModel: HackathonModel;
  private isRunning = false;

  constructor(db: Database) {
    this.hackathonModel = new HackathonModel(db);
    
    // Initialize HTTP client with rate limiting
    this.httpClient = new HttpClient({
      userAgent: process.env.USER_AGENT || 'HackathonSnifferBot/0.1 (+contact@example.com)',
      timeout: parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10),
      maxRetries: 3,
      rateLimitConfig: {
        maxConcurrent: parseInt(process.env.MAX_CONCURRENCY || '3', 10),
        minTime: 1000, // 1 second between requests
      },
    });

    // Initialize adapters
    this.adapters = [
      new DevpostAdapter(this.httpClient),
      // TODO: Add MLH and Eventbrite adapters
    ];
  }

  /**
   * Start the scheduled ingestion process
   */
  start(): void {
    const cronExpression = process.env.INGEST_CRON || '0 3 * * *'; // Default: daily at 3 AM
    
    console.log(`🕐 Starting ingestion scheduler with cron: ${cronExpression}`);
    
    cron.schedule(cronExpression, async () => {
      if (this.isRunning) {
        console.log('⏳ Ingestion already running, skipping this cycle');
        return;
      }

      try {
        await this.runIngestion();
      } catch (error) {
        console.error('❌ Scheduled ingestion failed:', error);
      }
    });

    console.log('✅ Ingestion scheduler started');
  }

  /**
   * Run ingestion once
   */
  async runIngestion(): Promise<ScrapingResult[]> {
    if (this.isRunning) {
      throw new Error('Ingestion is already running');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const results: ScrapingResult[] = [];

    console.log('🚀 Starting ingestion process...');

    try {
      for (const adapter of this.adapters) {
        const result = await this.runAdapterIngestion(adapter);
        results.push(result);
      }

      const totalDuration = Date.now() - startTime;
      const totalFound = results.reduce((sum, r) => sum + r.events_found, 0);
      const totalCreated = results.reduce((sum, r) => sum + r.events_created, 0);
      const totalUpdated = results.reduce((sum, r) => sum + r.events_updated, 0);

      console.log('✅ Ingestion completed successfully');
      console.log(`📊 Summary: ${totalFound} found, ${totalCreated} created, ${totalUpdated} updated in ${totalDuration}ms`);

      return results;

    } finally {
      this.isRunning = false;
    }
  }

  private async runAdapterIngestion(adapter: AdapterInterface): Promise<ScrapingResult> {
    const startTime = Date.now();
    const result: ScrapingResult = {
      source_id: adapter.source_id,
      events_found: 0,
      events_processed: 0,
      events_created: 0,
      events_updated: 0,
      errors: [],
      duration_ms: 0,
      scraped_at: new Date().toISOString(),
    };

    console.log(`🔍 Starting ${adapter.name} ingestion...`);

    try {
      // Check robots.txt compliance
      const isCompliant = await adapter.isRobotsTxtCompliant();
      if (!isCompliant) {
        throw new Error(`${adapter.name} scraping is not compliant with robots.txt`);
      }

      // Scrape events
      const scrapedEvents = await adapter.scrape();
      result.events_found = scrapedEvents.length;

      console.log(`📥 ${adapter.name}: Found ${scrapedEvents.length} events`);

      // Process each event
      for (const event of scrapedEvents) {
        try {
          await this.processEvent(event, result);
          result.events_processed++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Event processing error: ${errorMessage}`);
          console.error(`❌ Error processing event: ${errorMessage}`);
        }
      }

      console.log(`✅ ${adapter.name}: Processed ${result.events_processed}/${result.events_found} events`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Adapter error: ${errorMessage}`);
      console.error(`❌ ${adapter.name} ingestion failed:`, error);
    }

    result.duration_ms = Date.now() - startTime;
    return result;
  }

  private async processEvent(event: NormalizedHackathon, result: ScrapingResult): Promise<void> {
    try {
      // Check for existing hackathon by URL
      let existingHackathon = null;
      
      if (event.website_url) {
        existingHackathon = await this.hackathonModel.findByUrl(event.website_url);
      }

      if (existingHackathon) {
        // Update existing hackathon
        const updated = await this.hackathonModel.update(existingHackathon.id, event);
        if (updated) {
          result.events_updated++;
          console.log(`🔄 Updated: ${event.title}`);
        }
      } else {
        // Check for duplicates based on content similarity
        const recentHackathons = await this.hackathonModel.findUpcoming(100);
        const duplicateGroups = DeduplicationService.findDuplicates([event, ...recentHackathons]);
        
        if (duplicateGroups.length > 0) {
          // Found potential duplicate, merge and update
          const group = duplicateGroups.find(g => g.duplicates.some(d => 
            d.title === event.title && d.source === event.source
          ));
          
          if (group) {
            const merged = DeduplicationService.mergeDuplicates(group.original, [event]);
            const existingId = recentHackathons.find(h => h.title === group.original.title)?.id;
            
            if (existingId) {
              await this.hackathonModel.update(existingId, merged);
              result.events_updated++;
              console.log(`🔄 Merged duplicate: ${event.title}`);
              return;
            }
          }
        }

        // Create new hackathon
        await this.hackathonModel.create(event);
        result.events_created++;
        console.log(`✨ Created: ${event.title}`);
      }

    } catch (error) {
      console.error(`❌ Error processing event "${event.title}":`, error);
      throw error;
    }
  }

  /**
   * Stop the scheduler and clean up resources
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping ingestion scheduler...');
    
    // Stop HTTP client
    await this.httpClient.close();
    
    console.log('✅ Ingestion scheduler stopped');
  }

  /**
   * Get the current status of the scheduler
   */
  getStatus(): { isRunning: boolean; adapters: string[] } {
    return {
      isRunning: this.isRunning,
      adapters: this.adapters.map(a => a.name),
    };
  }
}
