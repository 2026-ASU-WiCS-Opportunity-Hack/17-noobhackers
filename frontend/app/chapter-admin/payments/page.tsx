"use client";

/**
 * Chapter payment reporting.
 * Requirement: 5.6
 */

import { RouteGuard } from "../../context/AuthContext";

const MOCK_PAYMENTS = [
  { id: "p1", type: "Student Enrollment", amount: 250, quantity: 5, status: "succeeded", date: "2026-03-15" },
  { id: "p2", type: "Coach Certification", amount: 90, quantity: 3, status: "succeeded", date: "2026-03-10" },
  { id: "p3", type: "Student Enrollment", amount: 100, quantity: 2, status: "overdue", date: "2026-02-20" },
];

function ChapterPaymentsContent() {
  const total = MOCK_PAYMENTS
    .filter((p) => p.status === "succeeded")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-wial-gray-900">Chapter Payments</h1>
      <p className="mt-1 text-wial-gray-600">
        Total collected: <span className="font-semibold text-wial-success">${total}</span>
      </p>

      <div className="mt-8 overflow-hidden rounded-xl border border-wial-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-wial-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Type</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Qty</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Amount</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-wial-gray-100">
            {MOCK_PAYMENTS.map((p) => (
              <tr key={p.id} className="hover:bg-wial-gray-50">
                <td className="px-4 py-3 text-wial-gray-900">{p.type}</td>
                <td className="px-4 py-3 text-wial-gray-600">{p.quantity}</td>
                <td className="px-4 py-3 font-medium text-wial-gray-900">${p.amount}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === "succeeded" ? "bg-wial-success/10 text-wial-success" : "bg-wial-error/10 text-wial-error"
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

export default function ChapterAdminPaymentsPage() {
  return (
    <RouteGuard requiredRole="Chapter_Lead">
      <ChapterPaymentsContent />
    </RouteGuard>
  );
}
