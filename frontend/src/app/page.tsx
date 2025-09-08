'use client';

import { useEffect } from 'react';
import { useHackathonStore } from '@/store/hackathon-store';
import { HackathonCard } from '@/components/hackathon-card';
import { SearchBar } from '@/components/search-bar';
import { FilterPanel } from '@/components/filter-panel';
import { Pagination } from '@/components/pagination';

export default function HomePage() {
  const { hackathons, loading, error, loadHackathons, pagination } = useHackathonStore();

  useEffect(() => {
    loadHackathons();
  }, [loadHackathons]);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
          Discover Amazing Hackathons
        </h1>
        <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
          Find and participate in hackathons from around the world. 
          From online coding competitions to local innovation events.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <SearchBar />
        </div>
        <div className="lg:w-80">
          <FilterPanel />
        </div>
      </div>

      {/* Results */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1">
          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading hackathons...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12">
              <div className="rounded-md bg-red-50 p-4 max-w-md mx-auto">
                <div className="text-red-800">
                  <h3 className="text-sm font-medium">Error loading hackathons</h3>
                  <p className="mt-1 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && !error && (
            <>
              {/* Results Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-gray-900">
                  {pagination.total > 0 ? (
                    <>
                      {pagination.total} hackathon{pagination.total !== 1 ? 's' : ''} found
                    </>
                  ) : (
                    'No hackathons found'
                  )}
                </h2>
              </div>

              {/* Hackathon Grid */}
              {hackathons.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {hackathons.map((hackathon) => (
                    <HackathonCard key={hackathon.id} hackathon={hackathon} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">
                    No hackathons match your current filters. Try adjusting your search criteria.
                  </p>
                </div>
              )}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-8">
                  <Pagination />
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar - Stats and Info */}
        <div className="lg:w-80 space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Quick Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Hackathons</span>
                <span className="text-sm font-medium text-gray-900">
                  {pagination.total}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Current Page</span>
                <span className="text-sm font-medium text-gray-900">
                  {pagination.page} of {pagination.totalPages}
                </span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              About This Platform
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Hackathon Sniffer automatically discovers and aggregates hackathon opportunities 
              from multiple sources across the web.
            </p>
            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <span className="badge-source mr-2">devpost</span>
                <span>Devpost hackathons</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <span className="badge-source mr-2">mlh</span>
                <span>MLH events (coming soon)</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <span className="badge-source mr-2">eventbrite</span>
                <span>Eventbrite listings (coming soon)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
