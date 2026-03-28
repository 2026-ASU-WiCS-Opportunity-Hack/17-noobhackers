"use client";

/**
 * Global payment dashboard with aggregated revenue.
 * Requirement: 5.7
 */

import { RouteGuard } from "../../context/AuthContext";

const MOCK_PAYMENTS = [
  { id: "p1", chapter: "USA", type: "Student Enrollment", amount: 500, status: "succeeded", date: "2026-03-15" },
  { id: "p2", chapter: "Brazil", type: "Coach Certification", amount: 90, status: "succeeded", date: "2026-03-14" },
  { id: "p3", chapter: "UK", type: "Student Enrollment", amount: 250, status: "pending", date: "2026-03-13" },
  { id: "p4", chapter: "Singapore", type: "Coach Certification", amount: 60, status: "succeeded", date: "2026-03-12" },
  { id: "p5", chapter: "USA", type: "Student Enrollment", amount: 150, status: "overdue", date: "2026-02-28" },
];

function PaymentsContent() {
  const totalRevenue = MOCK_PAYMENTS
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-wial-gray-900">Payments</h1>
      <p className="mt-1 text-wial-gray-600">
        Global revenue: <span className="font-semibold text-wial-success">${totalRevenue.toLocaleString()}</span>
      </p>

      <div className="mt-8 overflow-hidden rounded-xl border border-wial-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-wial-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Chapter</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Type</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Amount</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-wial-gray-100">
            {MOCK_PAYMENTS.map((p) => (
              <tr key={p.id} className="hover:bg-wial-gray-50">
                <td className="px-4 py-3 text-wial-gray-900">{p.chapter}</td>
                <td className="px-4 py-3 text-wial-gray-600">{p.type}</td>
                <td className="px-4 py-3 font-medium text-wial-gray-900">${p.amount}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === "succeeded" ? "bg-wial-success/10 text-wial-success" :
                    p.status === "pending" ? "bg-wial-warning/10 text-wial-warning" :
                    "bg-wial-error/10 text-wial-error"
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-wial-gray-500">{p.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminPaymentsPage() {
  return (
    <RouteGuard requiredRole="Super_Admin">
      <PaymentsContent />
    </RouteGuard>
  );
}
