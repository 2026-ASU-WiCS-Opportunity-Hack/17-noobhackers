/**
 * Interactive chapter map/directory — displays WIAL chapters by region.
 * Requirement: 1.1
 */

import Link from "next/link";

interface ChapterInfo {
  name: string;
  slug: string;
  region: string;
}

const CHAPTERS_BY_REGION: Record<string, ChapterInfo[]> = {
  "North America": [
    { name: "USA", slug: "usa", region: "North America" },
    { name: "Canada", slug: "canada", region: "North America" },
    { name: "Mexico", slug: "mexico", region: "North America" },
  ],
  "South America": [
    { name: "Brazil", slug: "brazil", region: "South America" },
    { name: "Colombia", slug: "colombia", region: "South America" },
  ],
  Europe: [
    { name: "United Kingdom", slug: "uk", region: "Europe" },
    { name: "Germany", slug: "germany", region: "Europe" },
    { name: "France", slug: "france", region: "Europe" },
  ],
  "Asia Pacific": [
    { name: "Singapore", slug: "singapore", region: "Asia Pacific" },
    { name: "Japan", slug: "japan", region: "Asia Pacific" },
    { name: "Australia", slug: "australia", region: "Asia Pacific" },
  ],
  Africa: [
    { name: "South Africa", slug: "south-africa", region: "Africa" },
    { name: "Nigeria", slug: "nigeria", region: "Africa" },
    { name: "Kenya", slug: "kenya", region: "Africa" },
  ],
};

export default function ChapterMap() {
  return (
    <div className="space-y-8">
      {Object.entries(CHAPTERS_BY_REGION).map(([region, chapters]) => (
        <div key={region}>
          <h3 className="text-lg font-semibold text-wial-gray-900">{region}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {chapters.map((ch) => (
              <Link
                key={ch.slug}
                href={`/${ch.slug}`}
                className="rounded-lg border border-wial-gray-200 px-4 py-2 text-sm font-medium text-wial-gray-700 transition-colors hover:border-wial-blue hover:text-wial-blue"
              >
                {ch.name}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
