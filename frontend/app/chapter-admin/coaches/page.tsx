"use client";

/**
 * Chapter Lead — manage coaches: view all, approve pending, create new.
 */

import { useState } from "react";
import { RouteGuard } from "../../context/AuthContext";

interface CoachRecord {
  id: string;
  name: string;
  email: string;
  country: string;
  certification: string;
  status: "active" | "pending_approval" | "pending_onboard";
}

const MOCK_COACHES: CoachRecord[] = [
  { id: "1", name: "Local Coach A", email: "coachA@example.com", country: "USA", certification: "CALC", status: "active" },
  { id: "2", name: "Local Coach B", email: "coachB@example.com", country: "USA", certification: "PALC", status: "active" },
  { id: "3", name: "New Applicant", email: "new@example.com", country: "USA", certification: "CALC", status: "pending_onboard" },
  { id: "4", name: "Profile Update", email: "update@example.com", country: "USA", certification: "SALC", status: "pending_approval" },
];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-wial-success/10 text-wial-success",
  pending_approval: "bg-wial-warning/10 text-wial-warning",
  pending_onboard: "bg-wial-info/10 text-wial-info",
};

function CoachManagementContent() {
  const [coaches] = useState(MOCK_COACHES);
  const pending = coaches.filter((c) => c.status !== "active");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-wial-gray-900">Manage Coaches</h1>
          <p className="mt-1 text-wial-gray-500">Track and manage all coaches in your chapter</p>
        </div>
        <button className="rounded-lg bg-wial-red px-4 py-2 text-sm font-medium text-white hover:bg-wial-red-light">
          + Add Coach
        </button>
      </div>

      {/* Pending actions */}
      {pending.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-wial-gray-900">Pending Actions ({pending.length})</h2>
          <div className="mt-3 space-y-2">
            {pending.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-wial-warning/30 bg-wial-warning/5 px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-wial-gray-900">{c.name}</p>
                  <p className="text-xs text-wial-gray-500">{c.email} · {c.status === "pending_onboard" ? "New onboarding request" : "Profile update pending"}</p>
                </div>
                <div className="flex gap-2">
                  <button className="rounded bg-wial-success px-3 py-1 text-xs font-semibold text-white hover:bg-wial-success/80">Approve</button>
                  <button className="rounded bg-wial-gray-200 px-3 py-1 text-xs font-semibold text-wial-gray-600 hover:bg-wial-gray-300">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All coaches table */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-wial-gray-900">All Coaches ({coaches.length})</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-wial-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-wial-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-wial-gray-600">Name</th>
                <th className="px-4 py-3 font-medium text-wial-gray-600">Email</th>
                <th className="px-4 py-3 font-medium text-wial-gray-600">Country</th>
                <th className="px-4 py-3 font-medium text-wial-gray-600">Level</th>
                <th className="px-4 py-3 font-medium text-wial-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wial-gray-100">
              {coaches.map((c) => (
                <tr key={c.id} className="hover:bg-wial-gray-50">
                  <td className="px-4 py-3 font-medium text-wial-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-wial-gray-600">{c.email}</td>
                  <td className="px-4 py-3 text-wial-gray-600">{c.country}</td>
                  <td className="px-4 py-3 text-wial-gray-600">{c.certification}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[c.status]}`}>
                      {c.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ChapterCoachesPage() {
  return (
    <RouteGuard requiredRole="Chapter_Lead">
      <CoachManagementContent />
    </RouteGuard>
  );
}
