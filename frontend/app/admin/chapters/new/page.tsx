"use client";

/**
 * One-click chapter provisioning form — Super Admin.
 * Calls POST /chapters via real API with JWT auth.
 * Requirement: 2.1, 2.2, 2.5, 2.6
 */

import { useState } from "react";
import { RouteGuard, useAuth } from "../../../context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/";

interface ChapterResult {
  chapterId: string;
  url: string;
  status: string;
}

function NewChapterContent() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    chapterName: "",
    slug: "",
    region: "",
    executiveDirectorEmail: "",
    externalLink: "",
  });
  const [result, setResult] = useState<ChapterResult | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}chapters`, {
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
        setResult(data);
      } else {
        setError(data.error?.message ?? "Failed to create chapter.");
      }
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setCreating(false);
    }
  };

  if (result) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-xl border border-wial-success/30 bg-wial-success/5 p-8">
          <h2 className="text-2xl font-bold text-wial-success">Chapter Created</h2>
          <p className="mt-2 text-wial-gray-600">
            {form.chapterName} is now live at{" "}
            <span className="font-mono text-wial-red">{result.url}</span>
          </p>
          <p className="mt-1 text-xs text-wial-gray-400">ID: {result.chapterId}</p>
          <a
            href={`/${form.slug}`}
            className="mt-4 inline-block rounded-lg bg-wial-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-wial-red-light"
          >
            Visit Chapter →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold text-wial-gray-900">Create New Chapter</h1>
      <p className="mt-2 text-wial-gray-600">One-click chapter provisioning</p>

      {error && (
        <div className="mt-4 rounded-lg border border-wial-error/30 bg-wial-error/5 p-3">
          <p className="text-sm text-wial-error">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field label="Chapter Name" required>
          <input
            type="text"
            required
            value={form.chapterName}
            onChange={(e) => setForm({ ...form, chapterName: e.target.value })}
            placeholder="WIAL USA"
            className="w-full rounded-lg border border-wial-gray-300 px-4 py-2.5 text-sm focus:border-wial-blue focus:outline-none focus:ring-2 focus:ring-wial-blue/20"
          />
        </Field>

        <Field label="URL Slug" required>
          <input
            type="text"
            required
            pattern="^[a-z0-9-]+$"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
            placeholder="usa"
            className="w-full rounded-lg border border-wial-gray-300 px-4 py-2.5 text-sm focus:border-wial-blue focus:outline-none focus:ring-2 focus:ring-wial-blue/20"
          />
          <p className="mt-1 text-xs text-wial-gray-400">Lowercase letters, numbers, hyphens only</p>
        </Field>

        <Field label="Region" required>
          <input
            type="text"
            required
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
            placeholder="North America"
            className="w-full rounded-lg border border-wial-gray-300 px-4 py-2.5 text-sm focus:border-wial-blue focus:outline-none focus:ring-2 focus:ring-wial-blue/20"
          />
        </Field>

        <Field label="Executive Director Email" required>
          <input
            type="email"
            required
            value={form.executiveDirectorEmail}
            onChange={(e) => setForm({ ...form, executiveDirectorEmail: e.target.value })}
            placeholder="director@example.com"
            className="w-full rounded-lg border border-wial-gray-300 px-4 py-2.5 text-sm focus:border-wial-blue focus:outline-none focus:ring-2 focus:ring-wial-blue/20"
          />
        </Field>

        <Field label="External Link (optional)">
          <input
            type="url"
            value={form.externalLink}
            onChange={(e) => setForm({ ...form, externalLink: e.target.value })}
            placeholder="https://affiliate-website.com"
            className="w-full rounded-lg border border-wial-gray-300 px-4 py-2.5 text-sm focus:border-wial-blue focus:outline-none focus:ring-2 focus:ring-wial-blue/20"
          />
        </Field>

        <button
          type="submit"
          disabled={creating}
          className="w-full rounded-lg bg-wial-blue px-4 py-3 font-medium text-white hover:bg-wial-blue-light disabled:opacity-60"
        >
          {creating ? "Creating Chapter..." : "Create Chapter"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-wial-gray-700">
        {label} {required && <span className="text-wial-error">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function NewChapterPage() {
  return (
    <RouteGuard requiredRole="Super_Admin">
      <NewChapterContent />
    </RouteGuard>
  );
}
