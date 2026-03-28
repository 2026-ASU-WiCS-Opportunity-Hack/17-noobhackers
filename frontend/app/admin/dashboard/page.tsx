"use client";

/**
 * Super Admin global dashboard — metrics overview.
 * Requirements: 3.2, 5.7, 11.1, 11.2, 11.3, 11.4
 */

import { RouteGuard } from "../../context/AuthContext";

const MOCK_METRICS = {
  activeChapters: 12,
  totalCoaches: 247,
  totalRevenue: 48500,
  paymentConversionRate: 0.92,
  duesCollectionStatus: { succeeded: 312, pending: 18, failed: 5, overdue: 8 },
};

function DashboardContent() {
  const m = MOCK_METRICS;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-wial-gray-900">
        Global Dashboard
      </h1>
      <p className="mt-1 text-wial-gray-600">Overview of the WIAL chapter network</p>

      {/* KPI cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Active Chapters" value={m.activeChapters} />
        <Card label="Total Coaches" value={m.totalCoaches} />
        <Card label="Total Revenue" value={`$${m.totalRevenue.toLocaleString()}`} />
        <Card label="Payment Conversion" value={`${(m.paymentConversionRate * 100).toFixed(0)}%`} />
      </div>

      {/* Dues status */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-wial-gray-900">Dues Collection Status</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatusCard label="Succeeded" count={m.duesCollectionStatus.succeeded} color="text-wial-success" />
          <StatusCard label="Pending" count={m.duesCollectionStatus.pending} color="text-wial-warning" />
          <StatusCard label="Failed" count={m.duesCollectionStatus.failed} color="text-wial-error" />
          <StatusCard label="Overdue" count={m.duesCollectionStatus.overdue} color="text-wial-error" />
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-wial-gray-200 bg-white p-6">
      <p className="text-sm font-medium text-wial-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-wial-gray-900">{value}</p>
    </div>
  );
}

function StatusCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-xl border border-wial-gray-200 bg-white p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{count}</p>
      <p className="text-sm text-wial-gray-500">{label}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <RouteGuard requiredRole="Super_Admin">
      <DashboardContent />
    </RouteGuard>
  );
}
