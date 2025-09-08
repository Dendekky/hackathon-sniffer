import { z } from 'zod';

// Zod schemas for validation
export const HackathonSchema = z.object({
  id: z.string().uuid(),
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
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateHackathonSchema = HackathonSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const UpdateHackathonSchema = CreateHackathonSchema.partial();

export const HackathonFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  is_online: z.coerce.boolean().optional(),
  search: z.string().optional(),
  start_date_from: z.string().datetime().optional(),
  start_date_to: z.string().datetime().optional(),
  location: z.string().optional(),
  source: z.enum(['devpost', 'mlh', 'eventbrite']).optional(),
});

// TypeScript types
export type Hackathon = z.infer<typeof HackathonSchema>;
export type CreateHackathon = z.infer<typeof CreateHackathonSchema>;
export type UpdateHackathon = z.infer<typeof UpdateHackathonSchema>;
export type HackathonFilters = z.infer<typeof HackathonFiltersSchema>;

// Database row type (may have different field types from API)
export interface HackathonRow {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  registration_deadline: string | null;
  location: string;
  is_online: number; // SQLite boolean as integer
  website_url: string | null;
  registration_url: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
