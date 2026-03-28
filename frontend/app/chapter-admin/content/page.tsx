"use client";

/**
 * Content editor for chapter pages (editable areas only).
 * Requirements: 3.3, 4.2
 */

import { useState } from "react";
import { RouteGuard } from "../../context/AuthContext";

const PAGES = [
  { slug: "about", title: "About", content: "Welcome to our chapter..." },
  { slug: "events", title: "Events", content: "Upcoming chapter events..." },
  { slug: "team", title: "Team", content: "Our leadership team..." },
  { slug: "resources", title: "Resources", content: "Chapter resources..." },
  { slug: "contact", title: "Contact", content: "Get in touch..." },
];

function ContentEditorContent() {
  const [selected, setSelected] = useState(PAGES[0]);
  const [content, setContent] = useState(selected.content);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-wial-gray-900">Content Editor</h1>
      <p className="mt-1 text-wial-gray-600">Edit chapter page content</p>

      <div className="mt-8 flex gap-6">
        {/* Page list */}
        <div className="w-48 shrink-0">
          <ul className="space-y-1" role="list">
            {PAGES.map((page) => (
              <li key={page.slug}>
                <button
                  onClick={() => { setSelected(page); setContent(page.content); }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    selected.slug === page.slug
                      ? "bg-wial-blue text-white"
                      : "text-wial-gray-700 hover:bg-wial-gray-100"
                  }`}
                >
                  {page.title}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Editor */}
        <div className="flex-1">
          <div className="rounded-xl border border-wial-gray-200 p-6">
            <h2 className="font-semibold text-wial-gray-900">{selected.title}</h2>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="mt-4 w-full rounded-lg border border-wial-gray-300 px-4 py-3 text-sm focus:border-wial-blue focus:outline-none focus:ring-2 focus:ring-wial-blue/20"
              aria-label={`Edit ${selected.title} content`}
            />
            <div className="mt-4 flex justify-end">
              <button className="rounded-lg bg-wial-blue px-4 py-2 text-sm font-medium text-white hover:bg-wial-blue-light">
                Save Changes
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-wial-gray-400">
            Header, footer, and navigation are locked by the global template and cannot be edited here.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ChapterAdminContentPage() {
  return (
    <RouteGuard requiredRole="Chapter_Lead">
      <ContentEditorContent />
    </RouteGuard>
  );
}
