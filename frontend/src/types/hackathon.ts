// Frontend types matching backend API
export interface Hackathon {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  registration_deadline?: string;
  location: string;
  is_online: boolean;
  website_url?: string;
  registration_url?: string;
  source: 'devpost' | 'mlh' | 'eventbrite';
  created_at: string;
  updated_at: string;
}

export interface HackathonFilters {
  page?: number;
  limit?: number;
  is_online?: boolean;
  search?: string;
  start_date_from?: string;
  start_date_to?: string;
  location?: string;
  source?: 'devpost' | 'mlh' | 'eventbrite';
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

export interface ApiError {
  error: string;
  statusCode: number;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

export interface HackathonStats {
  countBySource: Record<string, number>;
  totalSources: number;
  totalHackathons: number;
}
