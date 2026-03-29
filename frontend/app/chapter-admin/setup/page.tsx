"use client";

/**
 * First-time chapter setup — Chapter Lead creates their chapter site.
 * Uses the global template, fills country-specific details.
 * Can only create one chapter.
 */

import { useState } from "react";
import { RouteGuard, useAuth } from "../../context/AuthContext";

function SetupContent() {
  const { user } = useAuth();
  const [created, setCreated] = useState(false);
  const [form, setForm] = useState({
    chapterName: "",
    country: "",
    slug: "",
    region: "",
    language: "en",
    executiveDirectorEmail: "",
    description: "",
    externalLink: "",
  });

  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [chapterUrl, setChapterUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/api/"}chapters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user?.idToken ? { Authorization: `Bearer ${user.idToken}` } : {}),
        },
        body: JSON.stringify({
          chapterName: form.chapterName,
          slug: form.slug,
          region: form.region,
          executiveDirectorEmail: form.executiveDirectorEmail,
          ...(form.externalLink ? { externalLink: form.externalLink } : {}),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setChapterUrl(`/${form.slug}`);
        setCreated(true);
      } else {
        setError(data.error?.message ?? "Failed to create chapter.");
      }
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setProcessing(false);
    }
  };

  if (created) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-xl border border-wial-success/30 bg-wial-success/5 p-8">
          <h2 className="text-2xl font-bold text-wial-success">Chapter Created!</h2>
          <p className="mt-3 text-wial-gray-600">
            Your chapter <span className="font-semibold">{form.chapterName}</span> is now live
          </p>
          <a href={chapterUrl} className="mt-2 inline-block font-mono text-wial-red hover:text-wial-red-light">
            Visit {chapterUrl} →
          </a>
          <p className="mt-2 text-sm text-wial-gray-500">
            The global template has been applied. You can now customize your chapter content.
          </p>
          <a href="/chapter-admin/dashboard" className="mt-6 inline-block rounded-lg bg-wial-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-wial-red-light">
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <h1 className="text-3xl font-bold text-wial-gray-900">Set Up Your Chapter</h1>
      <p className="mt-2 text-wial-gray-500">
        Create your country chapter website using the WIAL global template.
        You can only create one chapter per account.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Chapter Name <span className="text-wial-error">*</span></span>
          <input type="text" required value={form.chapterName} onChange={(e) => setForm({ ...form, chapterName: e.target.value })}
            placeholder="e.g. WIAL Brazil" className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none focus:ring-2 focus:ring-wial-red/20" />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Country <span className="text-wial-error">*</span></span>
          <input type="text" required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
            placeholder="e.g. Brazil" className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none focus:ring-2 focus:ring-wial-red/20" />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">URL Slug <span className="text-wial-error">*</span></span>
          <div className="mt-1 flex items-center">
            <span className="rounded-l-lg border border-r-0 border-wial-gray-200 bg-wial-gray-50 px-3 py-2.5 text-sm text-wial-gray-500">wial.org/</span>
            <input type="text" required pattern="^[a-z0-9-]+$" value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
              placeholder="brazil" className="w-full rounded-r-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" />
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Region <span className="text-wial-error">*</span></span>
          <select required value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none">
            <option value="">Select region</option>
            <option value="North America">North America</option>
            <option value="South America">South America</option>
            <option value="Europe">Europe</option>
            <option value="Asia Pacific">Asia Pacific</option>
            <option value="Africa">Africa</option>
            <option value="Oceania">Oceania</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Chapter Language <span className="text-wial-error">*</span></span>
          <p className="text-xs text-wial-gray-400 mt-0.5">The template and default content will be in this language</p>
          <select required value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none">
            <option value="en">🇬🇧 English</option>
            <option value="es">🇪🇸 Spanish (Español)</option>
            <option value="pt">🇧🇷 Portuguese (Português)</option>
            <option value="fr">🇫🇷 French (Français)</option>
            <option value="de">🇩🇪 German (Deutsch)</option>
            <option value="hi">🇮🇳 Hindi (हिन्दी)</option>
            <option value="zh">🇨🇳 Chinese (中文)</option>
            <option value="ja">🇯🇵 Japanese (日本語)</option>
            <option value="ko">🇰🇷 Korean (한국어)</option>
            <option value="ar">🇸🇦 Arabic (العربية)</option>
            <option value="sw">🇰🇪 Swahili (Kiswahili)</option>
            <option value="ms">🇲🇾 Malay (Bahasa Melayu)</option>
            <option value="th">🇹🇭 Thai (ไทย)</option>
            <option value="ru">🇷🇺 Russian (Русский)</option>
            <option value="it">🇮🇹 Italian (Italiano)</option>
            <option value="nl">🇳🇱 Dutch (Nederlands)</option>
            <option value="tr">🇹🇷 Turkish (Türkçe)</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Executive Director Email <span className="text-wial-error">*</span></span>
          <input type="email" required value={form.executiveDirectorEmail}
            onChange={(e) => setForm({ ...form, executiveDirectorEmail: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Chapter Description</span>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
            placeholder="Describe your chapter..." className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-3 text-sm focus:border-wial-red focus:outline-none" />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">External Affiliate Link (optional)</span>
          <input type="url" value={form.externalLink} onChange={(e) => setForm({ ...form, externalLink: e.target.value })}
            placeholder="https://your-affiliate-site.com" className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" />
        </label>

        <button type="submit" disabled={processing}
          className="w-full rounded-lg bg-wial-red px-4 py-3 text-sm font-semibold text-white hover:bg-wial-red-light disabled:opacity-60">
          {processing ? "Creating Chapter..." : "Create Chapter Website"}
        </button>

        {error && (
          <div className="mt-4 rounded-lg border border-wial-error/30 bg-wial-error/5 p-3">
            <p className="text-sm text-wial-error">{error}</p>
          </div>
        )}
      </form>
    </div>
  );
}

export default function ChapterSetupPage() {
  return (
    <RouteGuard requiredRole="Chapter_Lead">
      <SetupContent />
    </RouteGuard>
  );
}
