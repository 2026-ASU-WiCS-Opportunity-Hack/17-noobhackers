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

  const fetchCoaches = useCallback(async () => {
    try {
      // First get chapterId from slug
      const chapRes = await fetch(`${API_URL}chapters`);
      const chapData = await chapRes.json();
      const chapterInfo = (chapData.chapters ?? [])
        .find((c: { slug: string }) => c.slug === chapter);

      if (!chapterInfo) {
        setError("Chapter not found.");
        setLoading(false);
        return;
      }

      // Fetch coaches filtered by chapterId
      let url = `${API_URL}coaches?chapterId=${chapterInfo.chapterId}`;
      if (search) url += `&keyword=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      const data = await res.json();
      setCoaches(data.coaches ?? []);
    } catch {
      setError("Failed to load coaches.");
    } finally {
      setLoading(false);
    }
  }, [chapter, search]);

  useEffect(() => { fetchCoaches(); }, [fetchCoaches]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    fetchCoaches();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-wial-gray-900">{chapterName} Coaches</h1>
      <p className="mt-2 text-wial-gray-600">Certified Action Learning Coaches in {chapterName}</p>

      <form onSubmit={handleSearch} className="mt-6 flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, location, language..."
          className="flex-1 rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none"
        />
        <button type="submit" className="rounded-lg bg-wial-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-wial-red-light">
          Search
        </button>
      </form>

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
