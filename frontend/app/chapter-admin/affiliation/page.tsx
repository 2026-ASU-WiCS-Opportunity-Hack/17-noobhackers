"use client";

/**
 * Chapter Lead — Pay chapter dues to WIAL Global.
 *
 * UC4: Affiliates and instructors pay WIAL Global:
 * - $50 USD per student enrolled in eLearning
 * - $30 USD per certified coach
 * Affiliates/instructors pay, not students.
 */

import { useState, useEffect, useCallback } from "react";
import { RouteGuard, useAuth } from "../../context/AuthContext";
import dynamic from "next/dynamic";

const StripeCheckout = dynamic(() => import("../../components/StripeCheckout"), { ssr: false });

interface PaymentRecord {
  paymentId: string;
  dueType: string;
  quantity: number;
  totalAmount: number;
  status: string;
  createdAt: string;
}

type DueType = "student_enrollment" | "coach_certification";
type Step = "dashboard" | "pay" | "stripe_checkout";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/";

function AffiliationContent() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("dashboard");
  const [dueType, setDueType] = useState<DueType>("student_enrollment");
  const [quantity, setQuantity] = useState(1);
  const [method, setMethod] = useState<"stripe" | "paypal">("stripe");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

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

  const unitPrice = dueType === "student_enrollment" ? 50 : 30;
  const total = quantity * unitPrice;
  const totalPaid = payments.reduce((s, p) => s + Number(p.totalAmount), 0);
  const studentPayments = payments.filter((p) => p.dueType === "student_enrollment");
  const coachPayments = payments.filter((p) => p.dueType === "coach_certification");
  const totalStudents = studentPayments.reduce((s, p) => s + Number(p.quantity), 0);
  const totalCoaches = coachPayments.reduce((s, p) => s + Number(p.quantity), 0);

  const handlePay = async () => {
    setProcessing(true); setError("");
    try {
      let res;
      if (isRowPayment && payingRowId) {
        // PUT — update existing record
        res = await fetch(`${API_URL}payments/${payingRowId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.idToken}` },
          body: JSON.stringify({ paymentMethod: method, payerEmail: user?.email }),
        });
      } else {
        // POST — create new
        res = await fetch(`${API_URL}payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.idToken}` },
          body: JSON.stringify({ chapterId: "chapter-lead-affiliation", paymentMethod: method, dueType, quantity, payerEmail: user?.email }),
        });
      }
      const data = await res.json();
      if (res.ok) {
        await fetchPayments();
        setStep("dashboard");
        setQuantity(1);
        setPayingRowId(null);
      } else { setError(data.error?.message ?? "Payment failed."); }
    } catch (err) { setError("Unable to reach payment service. Please ensure the backend is deployed with: cd backend && cdk deploy --all"); }
    finally { setProcessing(false); }
  };

  // Pay a specific pending payment — opens payment form with pre-selected type
  const [payingRowId, setPayingRowId] = useState<string | null>(null);

  const payRow = (p: PaymentRecord) => {
    setDueType(p.dueType as DueType);
    setQuantity(Number(p.quantity));
    setPayingRowId(p.paymentId);
    // Show the payment method selection step first
    setStep("pay");
  };

  // True when paying an existing row (locks due type, uses PUT)
  const isRowPayment = payingRowId !== null;

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-wial-gray-200 border-t-wial-red" /></div>;

  // ── STRIPE CHECKOUT ──
  if (step === "stripe_checkout") {
    return (
      <StripeCheckout
        dueType={dueType}
        quantity={quantity}
        chapterId="chapter-lead-affiliation"
        onSuccess={async (pid, amt) => {
          // If paying an existing row, update its status via PUT
          if (isRowPayment && payingRowId) {
            try {
              await fetch(`${API_URL}payments/${payingRowId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.idToken}` },
                body: JSON.stringify({ paymentMethod: "stripe", payerEmail: user?.email, status: "succeeded" }),
              });
            } catch { /* the new payment record is already created */ }
          }
          await fetchPayments();
          setStep("dashboard");
          setPayingRowId(null);
        }}
        onCancel={() => setStep("pay")}
      />
    );
  }

  // ── PAY STEP ──
  if (step === "pay") {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <button onClick={() => { setStep("dashboard"); setPayingRowId(null); }} className="mb-4 text-sm text-wial-gray-500 hover:text-wial-red">← Back to Dashboard</button>
        <h1 className="text-2xl font-bold text-wial-gray-900">Pay Chapter Dues</h1>
        <p className="mt-1 text-sm text-wial-gray-500">Affiliates and instructors pay WIAL Global directly</p>

        {error && <div className="mt-4 rounded-lg border border-wial-error/30 bg-wial-error/5 p-3"><p className="text-sm text-wial-error">{error}</p></div>}

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-wial-gray-700">Dues Type {isRowPayment && <span className="text-xs text-wial-gray-400">(locked)</span>}</p>
            <div onClick={() => { if (!isRowPayment) setDueType("student_enrollment"); }}
              className={`flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left ${dueType === "student_enrollment" ? "border-wial-red bg-wial-red/5" : "border-wial-gray-200"} ${isRowPayment ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}>
              <span className="text-xl">🎓</span>
              <div><p className="text-sm font-semibold text-wial-gray-900">Student Enrollment — $50/student</p><p className="text-xs text-wial-gray-500">Per student enrolled in eLearning platform</p></div>
            </div>
            <div onClick={() => { if (!isRowPayment) setDueType("coach_certification"); }}
              className={`flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left ${dueType === "coach_certification" ? "border-wial-red bg-wial-red/5" : "border-wial-gray-200"} ${isRowPayment ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}>
              <span className="text-xl">🏅</span>
              <div><p className="text-sm font-semibold text-wial-gray-900">Coach Certification — $30/coach</p><p className="text-xs text-wial-gray-500">Per student fully certified and encoded as coach</p></div>
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-wial-gray-700">Number of {dueType === "student_enrollment" ? "students" : "coaches"} {isRowPayment && <span className="text-xs text-wial-gray-400">(from original due)</span>}</span>
            <input type="number" min={1} max={1000} value={quantity} onChange={(e) => { if (!isRowPayment) setQuantity(Math.max(1, parseInt(e.target.value) || 1)); }}
              readOnly={isRowPayment}
              className={`mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none ${isRowPayment ? "bg-wial-gray-50 text-wial-gray-500" : ""}`} />
          </label>

          <div>
            <p className="text-sm font-medium text-wial-gray-700 mb-2">Payment Method</p>
            <div className="flex gap-3">
              <button onClick={() => setMethod("stripe")} className={`flex-1 rounded-lg border-2 py-3 text-center text-sm font-semibold ${method === "stripe" ? "border-wial-red text-wial-red" : "border-wial-gray-200 text-wial-gray-500"}`}>💳 Stripe</button>
              <button onClick={() => setMethod("paypal")} className={`flex-1 rounded-lg border-2 py-3 text-center text-sm font-semibold ${method === "paypal" ? "border-wial-red text-wial-red" : "border-wial-gray-200 text-wial-gray-500"}`}>🅿️ PayPal</button>
            </div>
          </div>

          <div className="rounded-lg bg-wial-gray-50 p-4 flex justify-between items-center">
            <span className="text-sm text-wial-gray-600">{quantity} × ${unitPrice}</span>
            <span className="text-2xl font-bold text-wial-gray-900">${total} USD</span>
          </div>

          <button onClick={() => { if (method === "stripe") { setStep("stripe_checkout"); } else { handlePay(); } }} disabled={processing}
            className="flex w-full items-center justify-center rounded-lg bg-wial-red py-3.5 text-sm font-semibold text-white hover:bg-wial-red-light disabled:opacity-60">
            {processing ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : method === "stripe" ? "Next — Enter Card Details" : `Complete Payment — $${total}`}
          </button>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ──
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-wial-gray-900">Chapter Dues</h1>
          <p className="mt-1 text-wial-gray-500">Payments to WIAL Global for student enrollments and coach certifications</p>
        </div>
        <button onClick={() => setStep("pay")} className="rounded-lg bg-wial-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-wial-red-light">
          + New Payment
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Total Paid</p>
          <p className="mt-1 text-2xl font-bold text-wial-success">${totalPaid}</p>
        </div>
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Students Enrolled</p>
          <p className="mt-1 text-2xl font-bold text-wial-gray-900">{totalStudents}</p>
        </div>
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Coaches Certified</p>
          <p className="mt-1 text-2xl font-bold text-wial-gray-900">{totalCoaches}</p>
        </div>
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Transactions</p>
          <p className="mt-1 text-2xl font-bold text-wial-gray-900">{payments.length}</p>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="mt-10 text-center py-12 rounded-lg border border-dashed border-wial-gray-300">
          <p className="text-wial-gray-400">No payments yet. Click "+ New Payment" to pay chapter dues.</p>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-lg border border-wial-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-wial-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-wial-gray-600">#</th>
                <th className="px-4 py-3 font-medium text-wial-gray-600">Type</th>
                <th className="px-4 py-3 font-medium text-wial-gray-600">Qty</th>
                <th className="px-4 py-3 font-medium text-wial-gray-600">Amount</th>
                <th className="px-4 py-3 font-medium text-wial-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-wial-gray-600">Date</th>
                <th className="px-4 py-3 font-medium text-wial-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wial-gray-100">
              {payments.map((p, idx) => (
                <tr key={p.paymentId} className="hover:bg-wial-gray-50">
                  <td className="px-4 py-3 text-xs text-wial-gray-400">{idx + 1}</td>
                  <td className="px-4 py-3 text-wial-gray-900">{p.dueType === "student_enrollment" ? "🎓 Student Enrollment" : "🏅 Coach Certification"}</td>
                  <td className="px-4 py-3 text-wial-gray-600">{p.quantity}</td>
                  <td className="px-4 py-3 font-medium text-wial-gray-900">${p.totalAmount}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === "succeeded" ? "bg-wial-success/10 text-wial-success" : p.status === "pending" ? "bg-wial-warning/10 text-wial-warning" : "bg-wial-error/10 text-wial-error"}`}>{p.status === "succeeded" ? "paid" : p.status}</span></td>
                  <td className="px-4 py-3 text-xs text-wial-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {p.status === "succeeded" ? (
                      <span className="text-xs text-wial-success">✓ Paid</span>
                    ) : (
                      <button onClick={() => payRow(p)}
                        className="rounded bg-wial-red px-3 py-1 text-xs font-semibold text-white hover:bg-wial-red-light">
                        Pay ${p.totalAmount}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AffiliationPage() {
  return (<RouteGuard requiredRole="Chapter_Lead"><AffiliationContent /></RouteGuard>);
}
