"use client";

/**
 * AI-powered coach search input — responsive, clean design.
 * Requirements: 6.4, 6.5, 8.3, 8.7
 */

import { useState } from "react";

interface CoachSearchBarProps {
  onSearch: (query: string) => void;
  isFallback?: boolean;
  isLoading?: boolean;
}

export default function CoachSearchBar({ onSearch, isFallback = false, isLoading = false }: CoachSearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row" role="search">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wial-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, location, language..."
            className="w-full rounded-lg border border-wial-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-wial-gray-900 placeholder:text-wial-gray-400 focus:border-wial-blue focus:outline-none focus:ring-2 focus:ring-wial-blue/20"
            aria-label="Search coaches"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-wial-gray-200 border-t-wial-blue" />
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="shrink-0 rounded-lg bg-wial-blue px-6 py-3 text-sm font-semibold text-white hover:bg-wial-blue-light disabled:opacity-50"
        >
          Search
        </button>
      </form>

      {isFallback && (
        <p className="mt-2 text-xs text-wial-warning" role="status">
          AI search is temporarily unavailable. Showing keyword-based results.
        </p>
      )}
    </div>
  );
}
