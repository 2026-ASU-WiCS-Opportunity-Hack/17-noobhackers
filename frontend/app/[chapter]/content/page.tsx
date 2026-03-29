"use client";

/**
 * Chapter content editor — edit chapter pages.
 * Route: /{chapter}/content
 */

import { useParams } from "next/navigation";
import { RouteGuard } from "../../context/AuthContext";

function ContentEditorContent() {
  const params = useParams();
  const chapter = params.chapter as string;
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-wial-gray-900">{chapterName} Content</h1>
      <p className="mt-1 text-wial-gray-500">Edit your chapter pages</p>
      <div className="mt-8 rounded-lg border border-wial-gray-200 bg-white p-8 text-center">
        <p className="text-wial-gray-400">Content editor coming soon.</p>
        <p className="mt-2 text-sm text-wial-gray-400">
          You will be able to edit your chapter hero, about, events, team, and resources pages here.
        </p>
      </div>
    </div>
  );
}

export default function ChapterContentPage() {
  return (<RouteGuard requiredRole="Chapter_Lead"><ContentEditorContent /></RouteGuard>);
}
