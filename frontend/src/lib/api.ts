import { Hackathon, HackathonFilters, PaginatedResponse, HackathonStats, ApiError } from '@/types/hackathon';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      let errorData: ApiError;
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          error: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        };
      }
      throw new Error(errorData.error);
    }

    return response.json();
  }

  async getHackathons(filters: HackathonFilters = {}): Promise<PaginatedResponse<Hackathon>> {
    const searchParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    const endpoint = `/api/hackathons${queryString ? `?${queryString}` : ''}`;
    
    return this.request<PaginatedResponse<Hackathon>>(endpoint);
  }

  async getHackathon(id: string): Promise<Hackathon> {
    return this.request<Hackathon>(`/api/hackathons/${id}`);
  }

  async getUpcomingHackathons(limit = 50): Promise<{ data: Hackathon[] }> {
    return this.request<{ data: Hackathon[] }>(`/api/hackathons/upcoming?limit=${limit}`);
  }

  async getHackathonStats(): Promise<HackathonStats> {
    return this.request<HackathonStats>('/api/hackathons/stats');
  }

  async healthCheck(): Promise<{ status: string; [key: string]: any }> {
    return this.request<{ status: string; [key: string]: any }>('/health');
  }
}

export const api = new ApiClient();

// Utility functions for date formatting
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startFormatted = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  
  const endFormatted = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  
  // If same month, show "Oct 15-17, 2024"
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${end.getDate()}, ${end.getFullYear()}`;
  }
  
  return `${startFormatted} - ${endFormatted}`;
}

export function isUpcoming(dateString: string): boolean {
  return new Date(dateString) > new Date();
}

export function isPast(dateString: string): boolean {
  return new Date(dateString) < new Date();
}

export function daysUntil(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
