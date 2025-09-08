import { create } from 'zustand';
import { Hackathon, HackathonFilters, PaginatedResponse } from '@/types/hackathon';
import { api } from '@/lib/api';

interface HackathonStore {
  // State
  hackathons: Hackathon[];
  selectedHackathon: Hackathon | null;
  filters: HackathonFilters;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  loading: boolean;
  error: string | null;

  // Actions
  setFilters: (filters: Partial<HackathonFilters>) => void;
  clearFilters: () => void;
  loadHackathons: () => Promise<void>;
  loadHackathon: (id: string) => Promise<void>;
  setPage: (page: number) => Promise<void>;
  setSearch: (search: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const initialFilters: HackathonFilters = {
  page: 1,
  limit: 20,
  search: '',
};

const initialPagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
};

export const useHackathonStore = create<HackathonStore>((set, get) => ({
  // Initial state
  hackathons: [],
  selectedHackathon: null,
  filters: initialFilters,
  pagination: initialPagination,
  loading: false,
  error: null,

  // Actions
  setFilters: (newFilters) => {
    const filters = { ...get().filters, ...newFilters, page: 1 }; // Reset to page 1 when filtering
    set({ filters });
    get().loadHackathons();
  },

  clearFilters: () => {
    set({ filters: initialFilters, pagination: initialPagination });
    get().loadHackathons();
  },

  loadHackathons: async () => {
    const { filters, setLoading, setError } = get();
    
    setLoading(true);
    setError(null);

    try {
      const response: PaginatedResponse<Hackathon> = await api.getHackathons(filters);
      
      set({
        hackathons: response.data,
        pagination: response.pagination,
        loading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load hackathons';
      setError(errorMessage);
      setLoading(false);
    }
  },

  loadHackathon: async (id: string) => {
    const { setLoading, setError } = get();
    
    setLoading(true);
    setError(null);

    try {
      const hackathon = await api.getHackathon(id);
      set({
        selectedHackathon: hackathon,
        loading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load hackathon';
      setError(errorMessage);
      setLoading(false);
    }
  },

  setPage: async (page: number) => {
    const filters = { ...get().filters, page };
    set({ filters });
    await get().loadHackathons();
  },

  setSearch: (search: string) => {
    const filters = { ...get().filters, search, page: 1 };
    set({ filters });
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      get().loadHackathons();
    }, 300);

    // Clear previous timeout
    if ((window as any).searchTimeout) {
      clearTimeout((window as any).searchTimeout);
    }
    (window as any).searchTimeout = timeoutId;
  },

  setLoading: (loading: boolean) => set({ loading }),

  setError: (error: string | null) => set({ error }),
}));
