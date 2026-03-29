"use client";

/**
 * Template management — multi-language templates for all regions.
 * Super Admin can view, edit, and manage templates per language.
 */

import { useState } from "react";
import { RouteGuard } from "../../context/AuthContext";

interface LangTemplate {
  code: string;
  flag: string;
  name: string;
  nativeName: string;
  region: string;
  status: "ready" | "draft" | "needs_review";
  lastUpdated: string;
  pages: number;
}

const TEMPLATES: LangTemplate[] = [
  { code: "en", flag: "🇬🇧", name: "English", nativeName: "English", region: "Global", status: "ready", lastUpdated: "2026-03-15", pages: 6 },
  { code: "es", flag: "🇪🇸", name: "Spanish", nativeName: "Español", region: "Latin America, Spain", status: "ready", lastUpdated: "2026-03-10", pages: 6 },
  { code: "pt", flag: "🇧🇷", name: "Portuguese", nativeName: "Português", region: "Brazil, Portugal", status: "ready", lastUpdated: "2026-03-08", pages: 6 },
  { code: "fr", flag: "🇫🇷", name: "French", nativeName: "Français", region: "France, Africa", status: "ready", lastUpdated: "2026-03-05", pages: 6 },
  { code: "de", flag: "🇩🇪", name: "German", nativeName: "Deutsch", region: "Germany, Austria, Switzerland", status: "ready", lastUpdated: "2026-02-28", pages: 6 },
  { code: "hi", flag: "🇮🇳", name: "Hindi", nativeName: "हिन्दी", region: "India", status: "ready", lastUpdated: "2026-02-25", pages: 6 },
  { code: "zh", flag: "🇨🇳", name: "Chinese", nativeName: "中文", region: "China, Taiwan, Singapore", status: "ready", lastUpdated: "2026-02-20", pages: 6 },
  { code: "ja", flag: "🇯🇵", name: "Japanese", nativeName: "日本語", region: "Japan", status: "ready", lastUpdated: "2026-02-18", pages: 6 },
  { code: "ko", flag: "🇰🇷", name: "Korean", nativeName: "한국어", region: "South Korea", status: "draft", lastUpdated: "2026-02-15", pages: 4 },
  { code: "ar", flag: "🇸🇦", name: "Arabic", nativeName: "العربية", region: "Middle East, North Africa", status: "ready", lastUpdated: "2026-02-10", pages: 6 },
  { code: "sw", flag: "🇰🇪", name: "Swahili", nativeName: "Kiswahili", region: "East Africa", status: "ready", lastUpdated: "2026-02-05", pages: 6 },
  { code: "ms", flag: "🇲🇾", name: "Malay", nativeName: "Bahasa Melayu", region: "Malaysia, Indonesia", status: "draft", lastUpdated: "2026-01-28", pages: 3 },
  { code: "th", flag: "🇹🇭", name: "Thai", nativeName: "ไทย", region: "Thailand", status: "draft", lastUpdated: "2026-01-20", pages: 4 },
  { code: "ru", flag: "🇷🇺", name: "Russian", nativeName: "Русский", region: "Russia, Central Asia", status: "ready", lastUpdated: "2026-01-15", pages: 6 },
  { code: "it", flag: "🇮🇹", name: "Italian", nativeName: "Italiano", region: "Italy", status: "ready", lastUpdated: "2026-01-10", pages: 6 },
  { code: "nl", flag: "🇳🇱", name: "Dutch", nativeName: "Nederlands", region: "Netherlands, Belgium", status: "draft", lastUpdated: "2026-01-05", pages: 5 },
  { code: "tr", flag: "🇹🇷", name: "Turkish", nativeName: "Türkçe", region: "Turkey", status: "draft", lastUpdated: "2025-12-20", pages: 4 },
];

const STATUS_STYLES: Record<string, string> = {
  ready: "bg-wial-success/10 text-wial-success",
  draft: "bg-wial-warning/10 text-wial-warning",
  needs_review: "bg-wial-info/10 text-wial-info",
};

function TemplatesContent() {
  const [filter, setFilter] = useState<"all" | "ready" | "draft">("all");
  const filtered = filter === "all" ? TEMPLATES : TEMPLATES.filter((t) => t.status === filter);
  const readyCount = TEMPLATES.filter((t) => t.status === "ready").length;
  const draftCount = TEMPLATES.filter((t) => t.status === "draft").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-wial-gray-900">Template Management</h1>
      <p className="mt-1 text-wial-gray-500">
        Multi-language templates for chapter websites. Each template includes all 6 core pages
        (About, Coach Directory, Events, Team, Resources, Contact) translated and localized.
      </p>

      {/* Summary */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Total Languages</p>
          <p className="mt-1 text-3xl font-bold text-wial-gray-900">{TEMPLATES.length}</p>
        </div>
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Ready</p>
          <p className="mt-1 text-3xl font-bold text-wial-success">{readyCount}</p>
        </div>
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">In Draft</p>
          <p className="mt-1 text-3xl font-bold text-wial-warning">{draftCount}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="mt-6 flex gap-2">
        {(["all", "ready", "draft"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${filter === f ? "bg-wial-red text-white" : "bg-wial-gray-100 text-wial-gray-600 hover:bg-wial-gray-200"}`}>
            {f === "all" ? `All (${TEMPLATES.length})` : f === "ready" ? `Ready (${readyCount})` : `Draft (${draftCount})`}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <div key={t.code} className="rounded-lg border border-wial-gray-200 bg-white p-5 hover:shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{t.flag}</span>
                <div>
                  <p className="text-sm font-bold text-wial-gray-900">{t.name}</p>
                  <p className="text-xs text-wial-gray-400">{t.nativeName}</p>
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[t.status]}`}>
                {t.status}
              </span>
            </div>
            <p className="mt-3 text-xs text-wial-gray-500">{t.region}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-wial-gray-400">
              <span>{t.pages}/6 pages</span>
              <span>Updated {t.lastUpdated}</span>
            </div>
            <button className="mt-3 w-full rounded bg-wial-gray-50 py-1.5 text-xs font-medium text-wial-gray-600 hover:bg-wial-gray-100">
              Edit Template
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminTemplatesPage() {
  return (
    <RouteGuard requiredRole="Super_Admin">
      <TemplatesContent />
    </RouteGuard>
  );
}
