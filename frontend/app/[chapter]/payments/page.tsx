"use client";

/**
 * Chapter payments — view payment history for this chapter.
 * Route: /{chapter}/payments
 */

import { useParams } from "next/navigation";
import { RouteGuard } from "../../context/AuthContext";

function PaymentsContent() {
  const params = useParams();
  const chapter = params.chapter as string;
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-wial-gray-900">{chapterName} Payments</h1>
      <p className="mt-1 text-wial-gray-500">Dues collection and payment history</p>
      <div className="mt-8 rounded-lg border border-wial-gray-200 bg-white p-8 text-center">
        <p className="text-wial-gray-400">Payment dashboard coming soon.</p>
        <p className="mt-2 text-sm text-wial-gray-400">
          You will be able to view dues, send reminders, and track payments here.
        </p>
      </div>
    </div>
  );
}

export default function ChapterPaymentsPage() {
  return (<RouteGuard requiredRole="Chapter_Lead"><PaymentsContent /></RouteGuard>);
}
