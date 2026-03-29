"use client";

/**
 * Chapter-filtered coach directory.
 * Requirement: 6.2
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import CoachCard from "../../components/CoachCard";
import CoachSearchBar from "../../components/CoachSearchBar";
import type { CoachProfile } from "../../components/CoachCard";

// Mock chapter coaches
const MOCK_CHAPTER_COACHES: CoachProfile[] = [
  {
    coachId: "c1",
    name: "Local Coach One",
    certificationLevel: "PALC",
    location: "Chapter Region",
    country: "USA",
    contactInfo: "coach@example.com",
    bio: "Experienced Action Learning coach serving the local chapter community with dedication and expertise.",
  },
  {
    coachId: "c2",
    name: "Local Coach Two",
    certificationLevel: "CALC",
    location: "Chapter Region",
    country: "USA",
    contactInfo: "coach@example.com",
    bio: "Newly certified coach bringing fresh perspectives to Action Learning practice in our region.",
  },
];

export default function ChapterCoachesPage() {
  const params = useParams();
  const chapter = (params.chapter as string) ?? "";
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  const [coaches] = useState<CoachProfile[]>(MOCK_CHAPTER_COACHES);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-wial-gray-900">
        {chapterName} Coaches
      </h1>
      <p className="mt-2 text-wial-gray-600">
        Certified Action Learning Coaches in {chapterName}
      </p>

      <div className="mt-6">
        <CoachSearchBar onSearch={() => {}} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {coaches.map((coach) => (
          <CoachCard key={coach.coachId} coach={coach} />
        ))}
      </div>
    </div>
  );
}
