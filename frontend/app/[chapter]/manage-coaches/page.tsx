"use client";

/**
 * Chapter coach management — add/view coaches for this chapter.
 * Route: /{chapter}/manage-coaches
 */

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { RouteGuard, useAuth } from "../../context/AuthContext";
import CertBadge from "../../components/CertBadge";
import type { CertificationLevel } from "../../config/designTokens";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/";

interface Coach {
  coachId: string;
  name: string;
  certificationLevel: string;
  location: string;
  contactInfo: string;
  bio: string;
  status: string;
}

function ManageCoachesContent() {
  const params = useParams();
  const chapter = params.chapter as string;
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const { user } = useAuth();

  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [chapterId, setChapterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", certificationLevel: "CALC", location: "",
    contactInfo: "", bio: "",
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchCoaches = useCallback(async () => {
    try {
      const chapRes = await fetch(`${API_URL}chapters`);
      const chapData = await chapRes.json();
      const info = (chapData.chapters ?? []).find((c: { slug: string }) => c.slug === chapter);
      if (!info) { setLoading(false); return; }
      setChapterId(info.chapterId);

      const res = await fetch(`${API_URL}coaches?chapterId=${info.chapterId}`);
      const data = await res.json();
      setCoaches(data.coaches ?? []);
    } catch {} finally { setLoading(false); }
  }, [chapter]);

  useEffect(() => { fetchCoaches(); }, [fetchCoaches]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`${API_URL}coaches`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.idToken}` },
        body: JSON.stringify({ ...form, chapterId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Coach ${form.name} added.`);
        setForm({ name: "", certificationLevel: "CALC", location: "", contactInfo: "", bio: "" });
        setShowForm(false);
        await fetchCoaches();
      } else { setError(data.error?.message ?? "Failed to add coach."); }
    } catch { setError("Unable to reach server."); }
    finally { setCreating(false); }
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-wial-gray-200 border-t-wial-red" /></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-wial-gray-900">{chapterName} Coaches</h1>
          <p className="mt-1 text-wial-gray-500">Manage coaches for your chapter</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-wial-red px-4 py-2 text-sm font-semibold text-white hover:bg-wial-red-light">
          {showForm ? "Cancel" : "+ Add Coach"}
        </button>
      </div>

      {success && <div className="mt-4 rounded-lg border border-wial-success/30 bg-wial-success/5 p-3"><p className="text-sm text-wial-success">{success}</p></div>}
      {error && <div className="mt-4 rounded-lg border border-wial-error/30 bg-wial-error/5 p-3"><p className="text-sm text-wial-error">{error}</p></div>}

      {showForm && (
        <form onSubmit={handleAdd} className="mt-6 rounded-lg border border-wial-gray-200 bg-white p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block"><span className="text-sm font-medium text-wial-gray-700">Name *</span>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" /></label>
            <label className="block"><span className="text-sm font-medium text-wial-gray-700">Certification *</span>
              <select value={form.certificationLevel} onChange={(e) => setForm({ ...form, certificationLevel: e.target.value })} className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none">
                <option value="CALC">CALC</option><option value="PALC">PALC</option><option value="SALC">SALC</option><option value="MALC">MALC</option>
              </select></label>
            <label className="block"><span className="text-sm font-medium text-wial-gray-700">Location *</span>
              <input type="text" required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" /></label>
            <label className="block"><span className="text-sm font-medium text-wial-gray-700">Contact *</span>
              <input type="text" required value={form.contactInfo} onChange={(e) => setForm({ ...form, contactInfo: e.target.value })} className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" /></label>
          </div>
          <label className="block"><span className="text-sm font-medium text-wial-gray-700">Bio *</span>
            <textarea required value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-3 text-sm focus:border-wial-red focus:outline-none" /></label>
          <button type="submit" disabled={creating} className="rounded-lg bg-wial-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-wial-red-light disabled:opacity-60">
            {creating ? "Adding..." : "Add Coach"}</button>
        </form>
      )}

      <div className="mt-8">
        {coaches.length === 0 ? (
          <p className="text-sm text-wial-gray-400">No coaches yet. Add your first coach above.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-wial-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-wial-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Name</th>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Level</th>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Location</th>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wial-gray-100">
                {coaches.map((c) => (
                  <tr key={c.coachId} className="hover:bg-wial-gray-50">
                    <td className="px-4 py-3 text-wial-gray-900">{c.name}</td>
                    <td className="px-4 py-3"><CertBadge level={c.certificationLevel as CertificationLevel} /></td>
                    <td className="px-4 py-3 text-wial-gray-600">{c.location}</td>
                    <td className="px-4 py-3 text-wial-gray-600">{c.contactInfo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ManageCoachesPage() {
  return (<RouteGuard requiredRole="Chapter_Lead"><ManageCoachesContent /></RouteGuard>);
}
