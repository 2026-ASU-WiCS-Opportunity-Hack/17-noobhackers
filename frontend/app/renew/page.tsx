"use client";

/**
 * Renew Membership — Coach pays dues via Stripe/PayPal.
 * UC4 flow: Login → Renew Membership → Select method → Pay → Status updated
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

type Step = "select" | "confirm" | "success";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/";

function RenewContent() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("select");
  const [method, setMethod] = useState<"stripe" | "paypal">("stripe");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ id: string; amount: number } | null>(null);

  const fetchPayments = useCallback(async () => {
    if (!user?.idToken) return;
    try {
      const res = await fetch(`${API_URL}payments`, { headers: { Authorization: `Bearer ${user.idToken}` } });
      if (res.ok) { const d = await res.json(); setPayments(d.payments ?? []); }
    } catch {} finally { setLoading(false); }
  }, [user?.idToken]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const totalPaid = payments.reduce((s, p) => s + Number(p.totalAmount), 0);
  const membershipActive = payments.some((p) => p.status === "succeeded" || p.status === "pending");

  const handlePay = async () => {
    setProcessing(true); setError("");
    try {
      const res = await fetch(`${API_URL}payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.idToken}` },
        body: JSON.stringify({ chapterId: "coach-membership", paymentMethod: method, dueType: "coach_certification", quantity: 1, payerEmail: user?.email }),
      });
      const data = await res.json();
      if (res.ok) {
        setReceipt({ id: data.paymentId, amount: data.amount ?? 30 });
        setStep("success");
        await fetchPayments();
      } else { setError(data.error?.message ?? "Payment failed."); }
    } catch { setError("Unable to reach payment service."); }
    finally { setProcessing(false); }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-wial-gray-200 border-t-wial-red" /></div>;

  if (step === "success" && receipt) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-xl border border-wial-success/30 bg-wial-success/5 p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-wial-success/20 text-3xl">✓</div>
          <h2 className="text-2xl font-bold text-wial-success">Membership Renewed</h2>
          <p className="mt-3 text-wial-gray-600">Payment of <span className="font-bold">${receipt.amount} USD</span> completed.</p>
          <p className="mt-1 text-sm text-wial-gray-500">Payment ID: {receipt.id}</p>
          <p className="mt-4 text-sm text-wial-gray-500">Your membership status has been updated.<br />Your chapter lead has been notified.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button onClick={() => { setStep("select"); setReceipt(null); }} className="rounded-lg bg-wial-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-wial-red-light">Make Another Payment</button>
            <a href="/my-learning" className="rounded-lg border border-wial-gray-200 px-6 py-2.5 text-sm font-medium text-wial-gray-700 hover:bg-wial-gray-50">Back to Dashboard</a>
          </div>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <button onClick={() => setStep("select")} className="mb-4 text-sm text-wial-gray-500 hover:text-wial-red">← Back</button>
        <h1 className="text-2xl font-bold text-wial-gray-900">Complete Payment</h1>
        <p className="mt-1 text-sm text-wial-gray-500">Coach Certification Renewal — $30 USD</p>
        {error && <div className="mt-4 rounded-lg border border-wial-error/30 bg-wial-error/5 p-3"><p className="text-sm text-wial-error">{error}</p></div>}
        <div className="mt-6">
          <p className="text-sm font-medium text-wial-gray-700 mb-2">Payment Method</p>
          <div className="flex gap-3">
            <button onClick={() => setMethod("stripe")} className={`flex-1 rounded-lg border-2 py-4 text-center text-sm font-semibold ${method === "stripe" ? "border-wial-red text-wial-red" : "border-wial-gray-200 text-wial-gray-500"}`}>💳 Stripe</button>
            <button onClick={() => setMethod("paypal")} className={`flex-1 rounded-lg border-2 py-4 text-center text-sm font-semibold ${method === "paypal" ? "border-wial-red text-wial-red" : "border-wial-gray-200 text-wial-gray-500"}`}>🅿️ PayPal</button>
          </div>
        </div>
        <div className="mt-6 rounded-lg bg-wial-gray-50 p-4 flex justify-between"><span className="text-sm text-wial-gray-600">Total</span><span className="text-2xl font-bold text-wial-gray-900">$30 USD</span></div>
        <button onClick={handlePay} disabled={processing}
          className="mt-6 flex w-full items-center justify-center rounded-lg bg-wial-red py-3.5 text-sm font-semibold text-white hover:bg-wial-red-light disabled:opacity-60">
          {processing ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : `Pay $30 via ${method === "stripe" ? "Stripe" : "PayPal"}`}
        </button>
      </div>
    );
  }

  // ── SELECT / DASHBOARD ──
  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
      <h1 className="text-3xl font-bold text-wial-gray-900">Renew Membership</h1>
      <p className="mt-2 text-wial-gray-500">Pay your annual certification dues to WIAL Global</p>

      <div className="mt-8 rounded-lg border border-wial-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-wial-gray-500">Membership Status</p>
            <p className={`mt-1 text-lg font-bold ${membershipActive ? "text-wial-success" : "text-wial-error"}`}>
              {membershipActive ? "Active" : "Expired"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-wial-gray-500">Total Paid</p>
            <p className="mt-1 text-lg font-bold text-wial-gray-900">${totalPaid}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border-2 border-wial-red/20 bg-wial-red/5 p-6">
        <h2 className="font-semibold text-wial-gray-900">Coach Certification Renewal</h2>
        <p className="mt-1 text-sm text-wial-gray-500">$30 USD — annual certification fee paid to WIAL Global</p>
        <button onClick={() => setStep("confirm")} className="mt-4 w-full rounded-lg bg-wial-red py-3 text-sm font-semibold text-white hover:bg-wial-red-light">
          Renew Now — $30
        </button>
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-wial-gray-900">Payment History</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-wial-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-wial-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Type</th>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Amount</th>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Status</th>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wial-gray-100">
                {payments.map((p) => (
                  <tr key={p.paymentId}>
                    <td className="px-4 py-3 text-wial-gray-900">{p.dueType === "student_enrollment" ? "Student Enrollment" : "Coach Certification"}</td>
                    <td className="px-4 py-3 font-medium text-wial-gray-900">${p.totalAmount}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === "succeeded" ? "bg-wial-success/10 text-wial-success" : "bg-wial-warning/10 text-wial-warning"}`}>{p.status}</span></td>
                    <td className="px-4 py-3 text-xs text-wial-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RenewPage() {
  return (<RouteGuard requiredRole="Coach"><RenewContent /></RouteGuard>);
}
