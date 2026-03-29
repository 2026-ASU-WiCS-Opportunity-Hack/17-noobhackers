"use client";

/**
 * Chapter content management — view and edit chapter page content.
 * Route: /{chapter}/content
 */

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { RouteGuard, useAuth } from "../../context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/";

interface PageContent {
  pageSlug: string;
  title: string;
  content: string;
  isCorePage: boolean;
}

const PAGE_ICONS: Record<string, string> = {
  about: "📖", "coach-directory": "👥", events: "📅",
  team: "🏢", resources: "📚", contact: "✉️",
};

const DEFAULT_CONTENT: Record<string, string> = {
  about: "Welcome to our WIAL chapter. We are dedicated to promoting Action Learning methodology in our region, helping organizations solve complex problems while developing leaders simultaneously.",
  "coach-directory": "Browse our certified Action Learning coaches. Each coach has been trained and certified through WIAL's rigorous certification program.",
  events: "Stay updated with our upcoming workshops, certification programs, and networking events. We host regular sessions for both new and experienced Action Learning practitioners.",
  team: "Our chapter is led by experienced Action Learning professionals committed to growing the practice in our region.",
  resources: "Access guides, case studies, and research papers on Action Learning. Our resource library helps practitioners deepen their understanding and improve their practice.",
  contact: "Get in touch with our chapter leadership for inquiries about certification, partnerships, or hosting Action Learning sessions in your organization.",
};

function ContentManager() {
  const params = useParams();
  const chapter = params.chapter as string;
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const { user } = useAuth();

  const [pages, setPages] = useState<PageContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [chapterId, setChapterId] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  const fetchPages = useCallback(async () => {
    try {
      const chapRes = await fetch(`${API_URL}chapters`);
      const chapData = await chapRes.json();
      const info = (chapData.chapters ?? []).find((c: { slug: string }) => c.slug === chapter);
      if (!info) { setLoading(false); return; }
      setChapterId(info.chapterId);

      const res = await fetch(`${API_URL}chapters/${info.chapterId}/pages`);
      if (res.ok) {
        const data = await res.json();
        let pageList: PageContent[] = data.pages ?? [];
        // Add default content for pages that have empty content
        pageList = pageList.map(p => ({
          ...p,
          content: p.content || DEFAULT_CONTENT[p.pageSlug] || "",
        }));
        setPages(pageList);
      }
    } catch {} finally { setLoading(false); }
  }, [chapter]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const handleSave = async (pageSlug: string) => {
    setSaving(true); setSuccess("");
    try {
      const res = await fetch(`${API_URL}chapters/${chapterId}/pages/${pageSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.idToken}` },
        body: JSON.stringify({ title: pages.find(p => p.pageSlug === pageSlug)?.title ?? pageSlug, content: editContent }),
      });
      if (res.ok) {
        setSuccess(`${pageSlug} updated.`);
        setEditing(null);
        await fetchPages();
      }
    } catch {} finally { setSaving(false); }
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-wial-gray-200 border-t-wial-red" /></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-wial-gray-900">{chapterName} Content</h1>
      <p className="mt-1 text-wial-gray-500">Manage your chapter page content</p>

      {success && <div className="mt-4 rounded-lg border border-wial-success/30 bg-wial-success/5 p-3"><p className="text-sm text-wial-success">{success}</p></div>}

      <div className="mt-8 space-y-4">
        {pages.map((page) => (
          <div key={page.pageSlug} className="rounded-xl border border-wial-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-wial-gray-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{PAGE_ICONS[page.pageSlug] ?? "📄"}</span>
                <h3 className="font-semibold text-wial-gray-900">{page.title}</h3>
                {page.isCorePage && <span className="rounded-full bg-wial-blue/10 px-2 py-0.5 text-[10px] font-bold text-wial-blue">Core Page</span>}
              </div>
              {editing === page.pageSlug ? (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(null)} className="rounded-lg border border-wial-gray-200 px-3 py-1.5 text-xs font-medium text-wial-gray-600 hover:bg-wial-gray-50">Cancel</button>
                  <button onClick={() => handleSave(page.pageSlug)} disabled={saving}
                    className="rounded-lg bg-wial-red px-3 py-1.5 text-xs font-bold text-white hover:bg-wial-red-light disabled:opacity-60">
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              ) : (
                <button onClick={() => { setEditing(page.pageSlug); setEditContent(page.content); }}
                  className="rounded-lg border border-wial-gray-200 px-3 py-1.5 text-xs font-medium text-wial-gray-600 hover:bg-wial-gray-50 transition-colors">
                  Edit
                </button>
              )}
            </div>
            <div className="px-5 py-4">
              {editing === page.pageSlug ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-wial-gray-200 px-4 py-3 text-sm focus:border-wial-red focus:outline-none"
                />
              ) : (
                <p className="text-sm text-wial-gray-600 leading-relaxed">{page.content || <span className="italic text-wial-gray-400">No content yet. Click Edit to add content.</span>}</p>
              )}
            </div>
          </div>
        ))}

        {pages.length === 0 && (
          <p className="text-center text-wial-gray-400 py-8">No pages found for this chapter.</p>
        )}
      </div>
    </div>
  );
}

export default function ChapterContentPage() {
  return (<RouteGuard requiredRole="Chapter_Lead"><ContentManager /></RouteGuard>);
}
