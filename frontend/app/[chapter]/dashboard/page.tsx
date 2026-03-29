"use client";

/**
 * Chapter dashboard — metrics and quick actions for Chapter Lead.
 * If the chapter doesn't exist yet, shows the setup form.
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

  const [chapterExists, setChapterExists] = useState<boolean | null>(null);
  const [stats, setStats] = useState({ coaches: 0, payments: 0 });
  const [loading, setLoading] = useState(true);

  // Setup form state
  const [setupForm, setSetupForm] = useState({
    chapterName: `WIAL ${chapterName}`,
    slug: chapter,
    region: "",
    executiveDirectorEmail: user?.email ?? "",
    externalLink: "",
  });
  const [creating, setCreating] = useState(false);
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const chapRes = await fetch(`${API_URL}chapters`);
        const chapData = await chapRes.json();
        const info = (chapData.chapters ?? []).find((c: { slug: string }) => c.slug === chapter);

        if (info) {
          setChapterExists(true);
          const coachRes = await fetch(`${API_URL}coaches?chapterId=${info.chapterId}`);
          const coachData = await coachRes.json();
          setStats({ coaches: (coachData.coaches ?? []).length, payments: 0 });
        } else {
          setChapterExists(false);
        }
      } catch { setChapterExists(false); }
      finally { setLoading(false); }
    }
    load();
  }, [chapter]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setSetupError("");
    try {
      const res = await fetch(`${API_URL}chapters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user?.idToken ? { Authorization: `Bearer ${user.idToken}` } : {}),
        },
        body: JSON.stringify({
          chapterName: setupForm.chapterName,
          slug: setupForm.slug,
          region: setupForm.region,
          executiveDirectorEmail: setupForm.executiveDirectorEmail,
          ...(setupForm.externalLink ? { externalLink: setupForm.externalLink } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setChapterExists(true);
        // Reload to show dashboard
        window.location.reload();
      } else {
        setSetupError(data.error?.message ?? "Failed to create chapter.");
      }
    } catch {
      setSetupError("Unable to reach the server.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-wial-gray-200 border-t-wial-red" /></div>;
  }

  // ── FIRST-TIME SETUP ──
  if (chapterExists === false) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-wial-red/10">
            <span className="text-3xl">🌍</span>
          </div>
          <h1 className="mt-4 text-3xl font-bold text-wial-gray-900">Set Up {chapterName}</h1>
          <p className="mt-2 text-wial-gray-500">
            Create your country chapter website. The WIAL global template will be applied automatically with 6 core pages.
          </p>
        </div>

        {setupError && (
          <div className="mt-6 rounded-xl border border-wial-error/30 bg-wial-error/5 p-3">
            <p className="text-sm text-wial-error">{setupError}</p>
          </div>
        )}

        <form onSubmit={handleSetup} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-semibold text-wial-gray-700">Chapter Name</span>
            <input type="text" required value={setupForm.chapterName}
              onChange={(e) => setSetupForm({ ...setupForm, chapterName: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-wial-gray-200 bg-wial-gray-50 px-4 py-3 text-sm transition-all focus:border-wial-red focus:bg-white focus:outline-none focus:ring-2 focus:ring-wial-red/20" />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-wial-gray-700">URL Slug</span>
            <div className="mt-1.5 flex items-center">
              <span className="rounded-l-xl border border-r-0 border-wial-gray-200 bg-wial-gray-100 px-3 py-3 text-sm text-wial-gray-500">wial.org/</span>
              <input type="text" required pattern="^[a-z0-9-]+$" value={setupForm.slug}
                onChange={(e) => setSetupForm({ ...setupForm, slug: e.target.value.toLowerCase() })}
                className="w-full rounded-r-xl border border-wial-gray-200 bg-wial-gray-50 px-4 py-3 text-sm focus:border-wial-red focus:bg-white focus:outline-none" />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-wial-gray-700">Region</span>
            <select required value={setupForm.region}
              onChange={(e) => setSetupForm({ ...setupForm, region: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-wial-gray-200 bg-wial-gray-50 px-4 py-3 text-sm focus:border-wial-red focus:outline-none">
              <option value="">Select region</option>
              <option value="North America">North America</option>
              <option value="South America">South America</option>
              <option value="Europe">Europe</option>
              <option value="Asia Pacific">Asia Pacific</option>
              <option value="Africa">Africa</option>
              <option value="Oceania">Oceania</option>
              <option value="Middle East">Middle East</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-wial-gray-700">Executive Director Email</span>
            <input type="email" required value={setupForm.executiveDirectorEmail}
              onChange={(e) => setSetupForm({ ...setupForm, executiveDirectorEmail: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-wial-gray-200 bg-wial-gray-50 px-4 py-3 text-sm focus:border-wial-red focus:bg-white focus:outline-none focus:ring-2 focus:ring-wial-red/20" />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-wial-gray-700">External Affiliate Link (optional)</span>
            <input type="url" value={setupForm.externalLink}
              onChange={(e) => setSetupForm({ ...setupForm, externalLink: e.target.value })}
              placeholder="https://your-affiliate-site.com"
              className="mt-1.5 w-full rounded-xl border border-wial-gray-200 bg-wial-gray-50 px-4 py-3 text-sm focus:border-wial-red focus:bg-white focus:outline-none" />
          </label>

          <button type="submit" disabled={creating}
            className="w-full rounded-xl bg-wial-red px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-wial-red/25 transition-all hover:bg-wial-red-light hover:shadow-xl disabled:opacity-60">
            {creating ? "Creating Chapter..." : "Create Chapter Website"}
          </button>
        </form>
      </div>
    );
  }

  // ── DASHBOARD ──
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-wial-gray-900">{chapterName} Dashboard</h1>
      <p className="mt-1 text-wial-gray-500">Welcome, {user?.email}</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-wial-gray-200 bg-white p-6">
          <p className="text-sm text-wial-gray-500">Coaches</p>
          <p className="mt-1 text-3xl font-bold text-wial-gray-900">{stats.coaches}</p>
        </div>
        <div className="rounded-xl border border-wial-gray-200 bg-white p-6">
          <p className="text-sm text-wial-gray-500">Status</p>
          <p className="mt-1 text-lg font-bold text-wial-success">Active</p>
        </div>
        <div className="rounded-xl border border-wial-gray-200 bg-white p-6">
          <p className="text-sm text-wial-gray-500">Quick Actions</p>
          <div className="mt-2 flex flex-col gap-2">
            <Link href={`/${chapter}/manage-coaches`} className="text-sm text-wial-red hover:underline">Manage Coaches →</Link>
            <Link href={`/${chapter}/content`} className="text-sm text-wial-red hover:underline">Edit Content →</Link>
            <Link href={`/${chapter}/payments`} className="text-sm text-wial-red hover:underline">Payments →</Link>
          </div>
        </div>
      </div>
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
