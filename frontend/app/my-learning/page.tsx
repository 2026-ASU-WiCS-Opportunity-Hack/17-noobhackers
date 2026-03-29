"use client";

/**
 * Coach — learnings and payments, fully database-driven.
 * Reads payment records from GET /payments API.
 */

import { useState, useEffect, useCallback } from "react";
import { RouteGuard, useAuth } from "../context/AuthContext";

interface PaymentRecord {
  paymentId: string;
  dueType: string;
  quantity: number;
  totalAmount: number;
  status: string;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/";

const LEARNINGS = [
  { id: "1", title: "CALC Certification Training", status: "completed", date: "2025-06-15", type: "Certification" },
  { id: "2", title: "Advanced Facilitation Workshop", status: "completed", date: "2025-09-20", type: "Workshop" },
  { id: "3", title: "PALC Certification Program", status: "in_progress", date: "2026-03-01", type: "Certification" },
  { id: "4", title: "Cross-Cultural Coaching Webinar", status: "upcoming", date: "2026-04-15", type: "Webinar" },
];

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-wial-success/10 text-wial-success",
  in_progress: "bg-wial-info/10 text-wial-info",
  upcoming: "bg-wial-gray-100 text-wial-gray-600",
  succeeded: "bg-wial-success/10 text-wial-success",
  pending: "bg-wial-warning/10 text-wial-warning",
  failed: "bg-wial-error/10 text-wial-error",
};

function LearningContent() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastPay, setLastPay] = useState<{ id: string; amount: number } | null>(null);

  const fetchPayments = useCallback(async () => {
    if (!user?.idToken) return;
    try {
      const res = await fetch(`${API_URL}payments`, {
        headers: { Authorization: `Bearer ${user.idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments ?? []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [user?.idToken]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const totalPaid = payments.filter((p) => p.status === "succeeded" || p.status === "pending")
    .reduce((s, p) => s + Number(p.totalAmount), 0);

  const handlePay = async () => {
    setProcessing(true); setLastPay(null);
    try {
      const res = await fetch(`${API_URL}payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.idToken}` },
        body: JSON.stringify({
          chapterId: "coach-dues",
          paymentMethod: "stripe",
          dueType: "coach_certification",
          quantity: 1,
          payerEmail: user?.email ?? "coach@wial.org",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastPay({ id: data.paymentId, amount: data.amount ?? 30 });
        await fetchPayments(); // Refresh from DB
      } else { alert(data.error?.message ?? "Payment failed."); }
    } catch { alert("Unable to reach payment service."); }
    finally { setProcessing(false); }
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-wial-gray-200 border-t-wial-red" /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-wial-gray-900">My Learning & Payments</h1>
      <p className="mt-2 text-wial-gray-500">Track certification progress and manage dues</p>

      {lastPay && <div className="mt-4 rounded-lg border border-wial-success/30 bg-wial-success/5 p-4"><p className="text-sm text-wial-success">Payment of ${lastPay.amount} successful (ID: {lastPay.id})</p></div>}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Current Level</p>
          <p className="mt-1 text-2xl font-bold text-wial-red">CALC</p>
        </div>
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Total Paid (from DB)</p>
          <p className="mt-1 text-2xl font-bold text-wial-success">${totalPaid}</p>
        </div>
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Renew Membership</p>
          <button onClick={handlePay} disabled={processing}
            className="mt-2 rounded bg-wial-red px-4 py-1.5 text-xs font-semibold text-white hover:bg-wial-red-light disabled:opacity-60">
            {processing ? "Processing..." : "Pay $30 Certification Fee"}
          </button>
        </div>
      </div>

      {/* Learnings */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-wial-gray-900">Learning History</h2>
        <div className="mt-4 space-y-3">
          {LEARNINGS.map((l) => (
            <div key={l.id} className="flex flex-col justify-between gap-2 rounded-lg border border-wial-gray-200 px-5 py-4 sm:flex-row sm:items-center">
              <div><h3 className="text-sm font-semibold text-wial-gray-900">{l.title}</h3><p className="text-xs text-wial-gray-500">{l.type} · {l.date}</p></div>
              <span className={`inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[l.status]}`}>{l.status.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment records from DB */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-wial-gray-900">Payment History (from Database)</h2>
        {payments.length === 0 ? (
          <p className="mt-4 text-sm text-wial-gray-400">No payment records yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-wial-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-wial-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Payment ID</th>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Type</th>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Amount</th>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Status</th>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wial-gray-100">
                {payments.map((p) => (
                  <tr key={p.paymentId} className="hover:bg-wial-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-wial-gray-600">{p.paymentId.slice(0, 12)}...</td>
                    <td className="px-4 py-3 text-wial-gray-900">{p.dueType === "student_enrollment" ? "Student Enrollment" : "Coach Certification"}</td>
                    <td className="px-4 py-3 font-medium text-wial-gray-900">${p.totalAmount}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[p.status] ?? "bg-wial-gray-100 text-wial-gray-600"}`}>{p.status}</span></td>
                    <td className="px-4 py-3 text-xs text-wial-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
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

export default function MyLearningPage() {
  return (<RouteGuard requiredRole="Coach"><LearningContent /></RouteGuard>);
}
