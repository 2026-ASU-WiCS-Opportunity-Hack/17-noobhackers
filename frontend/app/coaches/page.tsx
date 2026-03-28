"use client";

/**
 * Global coach directory — responsive, clean layout with search and filters.
 * Requirements: 6.1, 6.4, 6.5, 6.9, 8.3, 8.7
 */

import { useState } from "react";
import CoachCard from "../components/CoachCard";
import CoachSearchBar from "../components/CoachSearchBar";
import type { CoachProfile } from "../components/CoachCard";
import type { CertificationLevel } from "../config/designTokens";

const MOCK_COACHES: CoachProfile[] = [
  { coachId: "1", name: "Dr. Sarah Chen", certificationLevel: "MALC", location: "Singapore", contactInfo: "coach@example.com", bio: "Master Action Learning Coach with 15 years of experience facilitating leadership development programs across Asia Pacific." },
  { coachId: "2", name: "Carlos Mendes", certificationLevel: "SALC", location: "São Paulo, Brazil", contactInfo: "coach@example.com", bio: "Senior coach focused on organizational transformation in Latin America. Fluent in Portuguese, Spanish, and English." },
  { coachId: "3", name: "Emily Thompson", certificationLevel: "PALC", location: "London, UK", contactInfo: "coach@example.com", bio: "Professional coach working with Fortune 500 companies on leadership development and team effectiveness." },
  { coachId: "4", name: "Amara Okafor", certificationLevel: "CALC", location: "Lagos, Nigeria", contactInfo: "coach@example.com", bio: "Certified coach passionate about bringing Action Learning to emerging markets in Africa." },
  { coachId: "5", name: "Kenji Tanaka", certificationLevel: "SALC", location: "Tokyo, Japan", contactInfo: "coach@example.com", bio: "Senior coach specializing in manufacturing and technology sectors. Bilingual in Japanese and English." },
  { coachId: "6", name: "Maria Garcia", certificationLevel: "PALC", location: "Mexico City, Mexico", contactInfo: "coach@example.com", bio: "Professional coach with a background in education and public sector leadership." },
];

const CERT_FILTERS: CertificationLevel[] = ["CALC", "PALC", "SALC", "MALC"];

export default function CoachDirectoryPage() {
  const [coaches, setCoaches] = useState<CoachProfile[]>(MOCK_COACHES);
  const [certFilter, setCertFilter] = useState<CertificationLevel | "">("");
  const [isFallback] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (query: string) => {
    setIsSearching(true);
    const q = query.toLowerCase();
    const results = MOCK_COACHES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.location.toLowerCase().includes(q) || c.bio.toLowerCase().includes(q),
    );
    setCoaches(results);
    setIsSearching(false);
  };

  const filtered = certFilter ? coaches.filter((c) => c.certificationLevel === certFilter) : coaches;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold text-wial-gray-900 sm:text-4xl">Coach Directory</h1>
      <p className="mt-2 text-base text-wial-gray-500 sm:text-lg">Find certified Action Learning Coaches worldwide</p>

      <div className="mt-8">
        <CoachSearchBar onSearch={handleSearch} isFallback={isFallback} isLoading={isSearching} />
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-wial-gray-500">Filter:</span>
        <button
          onClick={() => setCertFilter("")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${certFilter === "" ? "bg-wial-blue text-white" : "bg-wial-gray-100 text-wial-gray-600 hover:bg-wial-gray-200"}`}
        >
          All
        </button>
        {CERT_FILTERS.map((level) => (
          <button
            key={level}
            onClick={() => setCertFilter(level)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${certFilter === level ? "bg-wial-blue text-white" : "bg-wial-gray-100 text-wial-gray-600 hover:bg-wial-gray-200"}`}
          >
            {level}
          </button>
        ))}
      </div>

      {/* Results grid — responsive: 1 col mobile, 2 col tablet, 3 col desktop */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((coach) => (
          <CoachCard key={coach.coachId} coach={coach} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-wial-gray-400">No coaches found matching your criteria.</p>
        </div>
      )}

      <p className="mt-8 text-center text-sm text-wial-gray-400">
        Showing {filtered.length} of {coaches.length} coaches
      </p>
    </div>
  );
}
