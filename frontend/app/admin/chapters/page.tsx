"use client";

/**
 * Chapter management list — Super Admin view.
 * Requirement: 3.2
 */

import Link from "next/link";
import { RouteGuard } from "../../context/AuthContext";

const MOCK_CHAPTERS = [
  { id: "ch-1", name: "WIAL USA", slug: "usa", region: "North America", status: "active" },
  { id: "ch-2", name: "WIAL Brazil", slug: "brazil", region: "South America", status: "active" },
  { id: "ch-3", name: "WIAL UK", slug: "uk", region: "Europe", status: "active" },
  { id: "ch-4", name: "WIAL Singapore", slug: "singapore", region: "Asia Pacific", status: "active" },
  { id: "ch-5", name: "WIAL South Africa", slug: "south-africa", region: "Africa", status: "inactive" },
];

function ChaptersContent() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-wial-gray-900">Chapters</h1>
        <Link
          href="/admin/chapters/new"
          className="rounded-lg bg-wial-blue px-4 py-2 text-sm font-medium text-white hover:bg-wial-blue-light"
        >
          + New Chapter
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-wial-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-wial-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Name</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Slug</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Region</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-wial-gray-100">
            {MOCK_CHAPTERS.map((ch) => (
              <tr key={ch.id} className="hover:bg-wial-gray-50">
                <td className="px-4 py-3 font-medium text-wial-gray-900">{ch.name}</td>
                <td className="px-4 py-3 text-wial-gray-600">{ch.slug}</td>
                <td className="px-4 py-3 text-wial-gray-600">{ch.region}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    ch.status === "active"
                      ? "bg-wial-success/10 text-wial-success"
                      : "bg-wial-gray-100 text-wial-gray-500"
                  }`}>
                    {ch.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminChaptersPage() {
  return (
    <RouteGuard requiredRole="Super_Admin">
      <ChaptersContent />
    </RouteGuard>
  );
}
