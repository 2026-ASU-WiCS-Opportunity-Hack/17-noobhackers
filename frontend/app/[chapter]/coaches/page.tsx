"use client";

/**
 * Chapter-filtered coach directory — fetches real coaches from API.
 * Requirement: 6.2
 */

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import CoachCard from "../../components/CoachCard";
import type { CoachProfile } from "../../components/CoachCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/";

export default function ChapterCoachesPage() {
  const params = useParams();
  const chapter = (params.chapter as string) ?? "";
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [viewAll, setViewAll] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

  const fetchCoaches = useCallback(async () => {
    try {
      if (viewAll) {
        let url = `${API_URL}coaches?limit=100`;
        const res = await fetch(url);
        const data = await res.json();
        setCoaches(data.coaches ?? []);
      } else {
        const chapRes = await fetch(`${API_URL}chapters`);
        const chapData = await chapRes.json();
        const chapterInfo = (chapData.chapters ?? [])
          .find((c: { slug: string }) => c.slug === chapter);
        if (!chapterInfo) { setError("Chapter not found."); setLoading(false); return; }

        const res = await fetch(`${API_URL}coaches?chapterId=${chapterInfo.chapterId}`);
        const data = await res.json();
        setCoaches(data.coaches ?? []);
      }
      setIsSearchMode(false);
      setIsFallback(false);
    } catch {
      setError("Failed to load coaches.");
    } finally {
      setLoading(false);
    }
  }, [chapter, viewAll]);

  useEffect(() => { fetchCoaches(); }, [fetchCoaches]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) { fetchCoaches(); return; }
    setLoading(true); setError(""); setIsFallback(false);
    try {
      // Use AI search endpoint with optional chapter filter
      let url = `${API_URL}coaches/search?q=${encodeURIComponent(search)}&limit=10`;
      if (!viewAll) url += `&chapter=${encodeURIComponent(chapter)}`;
      const res = await fetch(url);
      const data = await res.json();
      setIsFallback(data.fallback ?? false);
      const results: CoachProfile[] = (data.results ?? []).map((r: CoachProfile) => ({
        coachId: r.coachId ?? "", name: r.name ?? "",
        certificationLevel: r.certificationLevel ?? "CALC",
        location: r.location ?? "", country: r.country ?? "",
        contactInfo: r.contactInfo ?? "", bio: r.bio ?? "",
      }));
      setCoaches(results);
      setIsSearchMode(true);
    } catch {
      setError("Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearch("");
    setIsSearchMode(false);
    setLoading(true);
    fetchCoaches();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-wial-gray-900">{viewAll ? "All" : chapterName} Coaches</h1>
      <p className="mt-2 text-wial-gray-600">
        {viewAll ? "All certified Action Learning Coaches worldwide" : `Certified Action Learning Coaches in ${chapterName}`}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => { setViewAll(false); setLoading(true); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${!viewAll ? "bg-wial-red text-white" : "border border-wial-gray-200 text-wial-gray-600 hover:bg-wial-gray-50"}`}
        >
          {chapterName} Only
        </button>
        <button
          onClick={() => { setViewAll(true); setLoading(true); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${viewAll ? "bg-wial-red text-white" : "border border-wial-gray-200 text-wial-gray-600 hover:bg-wial-gray-50"}`}
        >
          View All Coaches
        </button>
      </div>

      <form onSubmit={handleSearch} className="mt-6 flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, location, language... (AI-powered)"
          className="flex-1 rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none"
        />
        <button type="submit" className="rounded-lg bg-wial-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-wial-red-light">
          Search
        </button>
      </form>

      {isFallback && (
        <p className="mt-2 text-xs text-wial-gold-dark">AI search unavailable — showing keyword results instead.</p>
      )}
      {isSearchMode && (
        <button onClick={clearSearch} className="mt-2 text-sm text-wial-red hover:underline">← Clear search</button>
      )}

      {error && <p className="mt-4 text-sm text-wial-error">{error}</p>}

      {loading ? (
        <div className="mt-12 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-wial-gray-200 border-t-wial-red" />
        </div>
      ) : coaches.length === 0 ? (
        <p className="mt-12 text-center text-wial-gray-400">No coaches found for this chapter yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {coaches.map((coach) => (
            <CoachCard key={coach.coachId} coach={coach} />
          ))}
        </div>
      )}
    </div>
  );
}
