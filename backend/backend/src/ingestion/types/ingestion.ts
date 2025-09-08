import { z } from 'zod';

// Raw event data from scrapers
export const RawEventSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  url: z.string().url(),
  raw_data: z.string(),
  content_hash: z.string(),
  processed: z.boolean().default(false),
  hackathon_id: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Normalized hackathon data from adapters
export const NormalizedHackathonSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  registration_deadline: z.string().datetime().optional(),
  location: z.string().max(500),
  is_online: z.boolean(),
  website_url: z.string().url().optional(),
  registration_url: z.string().url().optional(),
  source: z.enum(['devpost', 'mlh', 'eventbrite']),
});

// Source configuration
export const SourceConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  base_url: z.string().url(),
  is_active: z.boolean().default(true),
  scrape_interval_hours: z.number().int().positive().default(24),
  last_scraped_at: z.string().datetime().optional(),
});

// Scraping result
export const ScrapingResultSchema = z.object({
  source_id: z.string(),
  events_found: z.number().int().min(0),
  events_processed: z.number().int().min(0),
  events_created: z.number().int().min(0),
  events_updated: z.number().int().min(0),
  errors: z.array(z.string()).default([]),
  duration_ms: z.number().int().min(0),
  scraped_at: z.string().datetime(),
});

// Adapter interface
export interface AdapterInterface {
  source_id: string;
  name: string;
  scrape(): Promise<NormalizedHackathon[]>;
  isRobotsTxtCompliant(): Promise<boolean>;
}

// Rate limiting configuration
export interface RateLimitConfig {
  maxConcurrent: number;
  minTime: number; // milliseconds between requests
  maxTime: number; // maximum time to wait
}

// Types
export type RawEvent = z.infer<typeof RawEventSchema>;
export type NormalizedHackathon = z.infer<typeof NormalizedHackathonSchema>;
export type SourceConfig = z.infer<typeof SourceConfigSchema>;
export type ScrapingResult = z.infer<typeof ScrapingResultSchema>;

// Error types
export class ScrapingError extends Error {
  constructor(
    message: string,
    public source_id: string,
    public url?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ScrapingError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public data: any, public zodError?: z.ZodError) {
    super(message);
    this.name = 'ValidationError';
  }
}
