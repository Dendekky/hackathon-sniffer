'use client';

import { useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useHackathonStore } from '@/store/hackathon-store';

export function SearchBar() {
  const { filters, setSearch } = useHackathonStore();
  const [searchValue, setSearchValue] = useState(filters.search || '');

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    setSearch(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchValue);
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search hackathons..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="input pl-10 pr-4 w-full md:w-96"
        />
      </div>
    </form>
  );
}
