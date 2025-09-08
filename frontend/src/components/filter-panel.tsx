'use client';

import { Fragment } from 'react';
import { Disclosure } from '@headlessui/react';
import { ChevronDownIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { useHackathonStore } from '@/store/hackathon-store';
import clsx from 'clsx';

const formatOptions = [
  { value: undefined, label: 'All Formats' },
  { value: true, label: 'Online' },
  { value: false, label: 'On-site' },
];

const sourceOptions = [
  { value: undefined, label: 'All Sources' },
  { value: 'devpost', label: 'Devpost' },
  { value: 'mlh', label: 'MLH' },
  { value: 'eventbrite', label: 'Eventbrite' },
];

export function FilterPanel() {
  const { filters, setFilters, clearFilters } = useHackathonStore();

  const handleFormatChange = (is_online: boolean | undefined) => {
    setFilters({ is_online });
  };

  const handleSourceChange = (source: 'devpost' | 'mlh' | 'eventbrite' | undefined) => {
    setFilters({ source });
  };

  const hasActiveFilters = filters.is_online !== undefined || filters.source !== undefined;

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <Disclosure defaultOpen>
        {({ open }) => (
          <>
            <Disclosure.Button className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50">
              <div className="flex items-center">
                <FunnelIcon className="h-5 w-5 mr-2 text-gray-500" />
                <span>Filters</span>
                {hasActiveFilters && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-800">
                    Active
                  </span>
                )}
              </div>
              <ChevronDownIcon
                className={clsx('h-5 w-5 text-gray-500 transition-transform', {
                  'rotate-180': open,
                })}
              />
            </Disclosure.Button>

            <Disclosure.Panel className="px-4 pb-4 space-y-4">
              {/* Format Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format
                </label>
                <div className="space-y-2">
                  {formatOptions.map((option) => (
                    <label key={String(option.value)} className="flex items-center">
                      <input
                        type="radio"
                        name="format"
                        checked={filters.is_online === option.value}
                        onChange={() => handleFormatChange(option.value)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source
                </label>
                <div className="space-y-2">
                  {sourceOptions.map((option) => (
                    <label key={option.value || 'all'} className="flex items-center">
                      <input
                        type="radio"
                        name="source"
                        checked={filters.source === option.value}
                        onChange={() => handleSourceChange(option.value as any)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700 capitalize">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="btn-ghost text-sm w-full justify-center"
                >
                  Clear Filters
                </button>
              )}
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
    </div>
  );
}
