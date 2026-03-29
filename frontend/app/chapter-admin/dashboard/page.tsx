"use client";

/**
 * Chapter Lead dashboard — overview with links to all CL features.
 */

import Link from "next/link";
import { RouteGuard } from "../../context/AuthContext";

const QUICK_LINKS = [
  { href: "/chapter-admin/coaches", label: "Manage Coaches", desc: "View, approve, and track coaches", icon: "👥" },
  { href: "/chapter-admin/events", label: "Events", desc: "Create training events", icon: "📅" },
  { href: "/chapter-admin/payments", label: "Coach Payments", desc: "Track dues from coaches", icon: "💰" },
  { href: "/chapter-admin/affiliation", label: "Affiliation Dues", desc: "Pay WIAL Global", icon: "🏛️" },
  { href: "/chapter-admin/content", label: "Edit Content", desc: "Update chapter pages", icon: "✏️" },
  { href: "/chapter-admin/setup", label: "Chapter Setup", desc: "Configure your chapter", icon: "⚙️" },
];

function DashboardContent() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-wial-gray-900">Chapter Dashboard</h1>
      <p className="mt-1 text-wial-gray-500">Manage your chapter and coaches</p>

      {/* KPI cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Total Coaches</p>
          <p className="mt-1 text-3xl font-bold text-wial-gray-900">18</p>
        </div>
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Revenue Collected</p>
          <p className="mt-1 text-3xl font-bold text-wial-gray-900">$4,200</p>
        </div>
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Pending Approvals</p>
          <p className="mt-1 text-3xl font-bold text-wial-warning">3</p>
        </div>
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Overdue Payments</p>
          <p className="mt-1 text-3xl font-bold text-wial-error">2</p>
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-10">
        <h2 className="text-lg font-bold text-wial-gray-900">Quick Actions</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href}
              className="flex items-start gap-3 rounded-lg border border-wial-gray-200 bg-white p-5 transition-colors hover:border-wial-red/30 hover:shadow-sm">
              <span className="text-2xl">{link.icon}</span>
              <div>
                <p className="text-sm font-bold text-wial-gray-900">{link.label}</p>
                <p className="mt-0.5 text-xs text-wial-gray-500">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChapterAdminDashboardPage() {
  return (
    <RouteGuard requiredRole="Chapter_Lead">
      <DashboardContent />
    </RouteGuard>
  );
}
