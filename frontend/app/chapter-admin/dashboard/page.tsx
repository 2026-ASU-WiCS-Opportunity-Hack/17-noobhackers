"use client";

/**
 * Chapter Lead dashboard — chapter-specific metrics.
 * Requirement: 3.3
 */

import { RouteGuard } from "../../context/AuthContext";

function ChapterDashboardContent() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-wial-gray-900">Chapter Dashboard</h1>
      <p className="mt-1 text-wial-gray-600">Manage your chapter</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-wial-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-wial-gray-500">Coaches</p>
          <p className="mt-1 text-3xl font-bold text-wial-gray-900">18</p>
        </div>
        <div className="rounded-xl border border-wial-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-wial-gray-500">Revenue</p>
          <p className="mt-1 text-3xl font-bold text-wial-gray-900">$4,200</p>
        </div>
        <div className="rounded-xl border border-wial-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-wial-gray-500">Conversion Rate</p>
          <p className="mt-1 text-3xl font-bold text-wial-gray-900">94%</p>
        </div>
        <div className="rounded-xl border border-wial-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-wial-gray-500">Overdue</p>
          <p className="mt-1 text-3xl font-bold text-wial-error">2</p>
        </div>
      </div>
    </div>
  );
}

export default function ChapterAdminDashboardPage() {
  return (
    <RouteGuard requiredRole="Chapter_Lead">
      <ChapterDashboardContent />
    </RouteGuard>
  );
}
