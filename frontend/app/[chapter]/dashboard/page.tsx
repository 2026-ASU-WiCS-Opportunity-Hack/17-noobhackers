"use client";

/**
 * Chapter dashboard — metrics and quick actions for Chapter Lead.
 * Route: /{chapter}/dashboard
 */

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { RouteGuard, useAuth } from "../../context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/";

function DashboardContent() {
  const params = useParams();
  const chapter = params.chapter as string;
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const { user } = useAuth();
  const [stats, setStats] = useState({ coaches: 0, payments: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const chapRes = await fetch(`${API_URL}chapters`);
        const chapData = await chapRes.json();
        const info = (chapData.chapters ?? []).find((c: { slug: string }) => c.slug === chapter);
        if (info) {
          const coachRes = await fetch(`${API_URL}coaches?chapterId=${info.chapterId}`);
          const coachData = await coachRes.json();
          setStats({ coaches: (coachData.coaches ?? []).length, payments: 0 });
        }
      } catch {} finally { setLoading(false); }
    }
    load();
  }, [chapter]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-wial-gray-900">{chapterName} Dashboard</h1>
      <p className="mt-1 text-wial-gray-500">Welcome, {user?.email}</p>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-wial-gray-200 border-t-wial-red" />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-wial-gray-200 bg-white p-6">
            <p className="text-sm text-wial-gray-500">Coaches</p>
            <p className="mt-1 text-3xl font-bold text-wial-gray-900">{stats.coaches}</p>
          </div>
          <div className="rounded-lg border border-wial-gray-200 bg-white p-6">
            <p className="text-sm text-wial-gray-500">Status</p>
            <p className="mt-1 text-lg font-bold text-wial-success">Active</p>
          </div>
          <div className="rounded-lg border border-wial-gray-200 bg-white p-6">
            <p className="text-sm text-wial-gray-500">Quick Actions</p>
            <div className="mt-2 flex flex-col gap-2">
              <Link href={`/${chapter}/manage-coaches`} className="text-sm text-wial-red hover:underline">Manage Coaches →</Link>
              <Link href={`/${chapter}/content`} className="text-sm text-wial-red hover:underline">Edit Content →</Link>
              <Link href={`/${chapter}/payments`} className="text-sm text-wial-red hover:underline">Payments →</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChapterDashboardPage() {
  return (
    <RouteGuard requiredRole="Chapter_Lead">
      <DashboardContent />
    </RouteGuard>
  );
}
