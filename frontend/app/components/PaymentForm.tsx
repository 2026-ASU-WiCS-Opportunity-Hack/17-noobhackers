"use client";

/**
 * Payment form — calls real backend API for Stripe/PayPal payments.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.9
 */

import { useState } from "react";
import { useAuth } from "../context/AuthContext";

type PaymentMethod = "stripe" | "paypal";
type DueType = "student_enrollment" | "coach_certification";

const UNIT_AMOUNTS: Record<DueType, number> = {
  student_enrollment: 50,
  coach_certification: 30,
};

const DUE_LABELS: Record<DueType, string> = {
  student_enrollment: "Student Enrollment ($50/student)",
  coach_certification: "Coach Certification ($30/coach)",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/";

export default function PaymentForm({ chapterId, onSuccess }: { chapterId?: string; onSuccess?: () => void }) {
  const { user } = useAuth();
  const [method, setMethod] = useState<PaymentMethod>("stripe");
  const [dueType, setDueType] = useState<DueType>("student_enrollment");
  const [quantity, setQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; paymentId?: string; amount?: number; error?: string } | null>(null);

  const total = quantity * UNIT_AMOUNTS[dueType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setResult(null);

    try {
      const res = await fetch(`${API_URL}payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user?.idToken ? { Authorization: `Bearer ${user.idToken}` } : {}),
        },
        body: JSON.stringify({
          chapterId: chapterId ?? "default-chapter",
          paymentMethod: method,
          dueType,
          quantity,
          payerEmail: user?.email ?? "demo@example.com",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ success: false, error: data.error?.message ?? "Payment failed" });
      } else {
        setResult({ success: true, paymentId: data.paymentId, amount: data.amount });
        onSuccess?.();
      }
    } catch {
      setResult({ success: false, error: "Unable to reach payment service. Check your connection." });
    } finally {
      setIsProcessing(false);
    }
  };

  if (result?.success) {
    return (
      <div className="rounded-xl border border-wial-success/30 bg-wial-success/5 p-8 text-center">
        <h3 className="text-xl font-bold text-wial-success">Payment Successful</h3>
        <p className="mt-2 text-wial-gray-600">Amount: ${result.amount} USD</p>
        <p className="text-sm text-wial-gray-500">Payment ID: {result.paymentId}</p>
        <p className="mt-4 text-sm text-wial-gray-500">A receipt will be sent to your email.</p>
        <button onClick={() => setResult(null)}
          className="mt-4 rounded-lg bg-wial-red px-4 py-2 text-sm font-medium text-white hover:bg-wial-red-light">
          Make Another Payment
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {result?.error && (
        <div className="rounded-lg border border-wial-error/30 bg-wial-error/5 p-4">
          <p className="text-sm text-wial-error">{result.error}</p>
        </div>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-wial-gray-700">Dues Type</legend>
        <div className="mt-2 space-y-2">
          {(Object.keys(DUE_LABELS) as DueType[]).map((type) => (
            <label key={type} className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="dueType" value={type} checked={dueType === type}
                onChange={() => setDueType(type)} className="h-4 w-4 text-wial-red" />
              <span className="text-sm text-wial-gray-700">{DUE_LABELS[type]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium text-wial-gray-700">Quantity</span>
        <input type="number" min={1} max={10000} value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" />
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-wial-gray-700">Payment Method</legend>
        <div className="mt-2 flex gap-3">
          {(["stripe", "paypal"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMethod(m)}
              className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium capitalize ${method === m ? "border-wial-red bg-wial-red/5 text-wial-red" : "border-wial-gray-200 text-wial-gray-600 hover:border-wial-gray-300"}`}>
              {m === "stripe" ? "Stripe" : "PayPal"}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="rounded-lg bg-wial-gray-50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-wial-gray-600">Total</span>
          <span className="text-2xl font-bold text-wial-gray-900">${total} USD</span>
        </div>
        <p className="mt-1 text-xs text-wial-gray-400">
          {quantity} × ${UNIT_AMOUNTS[dueType]} per {dueType === "student_enrollment" ? "student" : "coach"}
        </p>
      </div>

      <button type="submit" disabled={isProcessing}
        className="flex w-full items-center justify-center rounded-lg bg-wial-red px-4 py-3 font-medium text-white hover:bg-wial-red-light disabled:opacity-60">
        {isProcessing ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          `Pay $${total} via ${method === "stripe" ? "Stripe" : "PayPal"}`
        )}
      </button>

      <p className="text-center text-xs text-wial-gray-400">
        {method === "stripe" ? "Test card: 4242 4242 4242 4242" : "PayPal test mode"}
      </p>
    </form>
  );
}
