"use client";

/**
 * Global coach directory — paginated, dropdown filters, AI search.
 * Loads all coaches from DynamoDB, displays 20 per page.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import CoachCard from "../components/CoachCard";
import CoachSearchBar from "../components/CoachSearchBar";
import type { CoachProfile } from "../components/CoachCard";
import type { CertificationLevel } from "../config/designTokens";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/";
const PAGE_SIZE = 20;
const CERT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Levels" },
  { value: "CALC", label: "CALC — Certified" },
  { value: "PALC", label: "PALC — Professional" },
  { value: "SALC", label: "SALC — Senior" },
  { value: "MALC", label: "MALC — Master" },
];

export default function CoachDirectoryPage() {
  const [allCoaches, setAllCoaches] = useState<CoachProfile[]>([]);
  const [displayCoaches, setDisplayCoaches] = useState<CoachProfile[]>([]);
  const [certFilter, setCertFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [isFallback, setIsFallback] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchActive, setSearchActive] = useState(false);
  const [page, setPage] = useState(1);

  const loadCoaches = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}coaches?limit=100`);
      if (res.ok) {
        const data = await res.json();
        const coaches: CoachProfile[] = (data.coaches ?? []).map((c: any) => ({
          coachId: c.coachId ?? "", name: c.name ?? "",
          certificationLevel: c.certificationLevel ?? "CALC",
          location: c.location ?? "", country: c.country ?? "",
          contactInfo: c.contactInfo ?? "", bio: c.bio ?? "",
        }));
        setAllCoaches(coaches);
        setDisplayCoaches(coaches);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCoaches(); }, [loadCoaches]);

  const countries = useMemo(() => {
    const set = new Set(allCoaches.map((c) => c.country).filter(Boolean));
    return Array.from(set).sort();
  }, [allCoaches]);

  const handleSearch = async (query: string) => {
    setIsSearching(true); setIsFallback(false); setSearchActive(true); setPage(1);
    try {
      const res = await fetch(`${API_URL}coaches/search?q=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setIsFallback(data.fallback ?? false);
        const results: CoachProfile[] = (data.results ?? []).map((r: any) => ({
          coachId: r.coachId ?? "", name: r.name ?? "",
          certificationLevel: r.certificationLevel ?? "CALC",
          location: r.location ?? "", country: r.country ?? "",
          contactInfo: r.contactInfo ?? "", bio: r.bio ?? "",
        }));
        setDisplayCoaches(results.length > 0 ? results : allCoaches);
        if (!results.length) setSearchActive(false);
      }
    } catch { setDisplayCoaches(allCoaches); setSearchActive(false); }
    finally { setIsSearching(false); }
  };

  const resetSearch = () => { setDisplayCoaches(allCoaches); setSearchActive(false); setIsFallback(false); setPage(1); };

  // Apply filters
  let filtered = displayCoaches;
  if (certFilter) filtered = filtered.filter((c) => c.certificationLevel === certFilter);
  if (countryFilter) filtered = filtered.filter((c) => c.country === countryFilter);

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [certFilter, countryFilter]);

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-wial-gray-200 border-t-wial-red" /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold text-wial-gray-900 sm:text-4xl">Coach Directory</h1>
      <p className="mt-2 text-base text-wial-gray-500">
        {allCoaches.length} certified Action Learning Coaches worldwide
        {searchActive && " — AI search results"}
      </p>

      <div className="mt-8"><CoachSearchBar onSearch={handleSearch} isFallback={isFallback} isLoading={isSearching} /></div>

      {searchActive && (
        <button onClick={resetSearch} className="mt-3 text-sm text-wial-red hover:text-wial-red-light">← Show all coaches</button>
      )}

      {/* Modern dropdown filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={certFilter}
            onChange={(e) => setCertFilter(e.target.value)}
            className="appearance-none rounded-lg border border-wial-gray-200 bg-white py-2 pl-4 pr-10 text-sm font-medium text-wial-gray-700 shadow-sm hover:border-wial-gray-300 focus:border-wial-red focus:outline-none focus:ring-2 focus:ring-wial-red/20"
          >
            {CERT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wial-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>

        <div className="relative">
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="appearance-none rounded-lg border border-wial-gray-200 bg-white py-2 pl-4 pr-10 text-sm font-medium text-wial-gray-700 shadow-sm hover:border-wial-gray-300 focus:border-wial-red focus:outline-none focus:ring-2 focus:ring-wial-red/20"
          >
            <option value="">All Countries ({countries.length})</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wial-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>

        {(certFilter || countryFilter) && (
          <button onClick={() => { setCertFilter(""); setCountryFilter(""); }}
            className="rounded-lg border border-wial-gray-200 px-3 py-2 text-xs font-medium text-wial-gray-500 hover:bg-wial-gray-50">
            Clear filters ✕
          </button>
        )}

        <span className="ml-auto text-sm text-wial-gray-400">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Coach grid */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paged.map((coach) => (<CoachCard key={coach.coachId} coach={coach} />))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-12 text-center"><p className="text-wial-gray-400">No coaches found matching your criteria.</p></div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-wial-gray-200 px-4 py-2 text-sm font-medium text-wial-gray-700 hover:bg-wial-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`h-9 w-9 rounded-lg text-sm font-medium ${
                p === page
                  ? "bg-wial-red text-white"
                  : "border border-wial-gray-200 text-wial-gray-600 hover:bg-wial-gray-50"
              }`}
            >
              {p}
            </button>
          ))}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-wial-gray-200 px-4 py-2 text-sm font-medium text-wial-gray-700 hover:bg-wial-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}

      <p className="mt-4 text-center text-sm text-wial-gray-400">
        Page {page} of {totalPages} · Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
      </p>
    </div>
  );
}
