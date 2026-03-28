"use client";

/**
 * Payment form — Stripe/PayPal dues payment with type selection,
 * quantity input, calculated total, and success/error display.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.9
 */

import { useState } from "react";

type PaymentMethod = "stripe" | "paypal";
type DueType = "student_enrollment" | "coach_certification";

interface PaymentResult {
  success: boolean;
  paymentId?: string;
  amount?: number;
  error?: string;
}

const UNIT_AMOUNTS: Record<DueType, number> = {
  student_enrollment: 50,
  coach_certification: 30,
};

const DUE_LABELS: Record<DueType, string> = {
  student_enrollment: "Student Enrollment ($50/student)",
  coach_certification: "Coach Certification ($30/coach)",
};

export default function PaymentForm() {
  const [method, setMethod] = useState<PaymentMethod>("stripe");
  const [dueType, setDueType] = useState<DueType>("student_enrollment");
  const [quantity, setQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);

  const total = quantity * UNIT_AMOUNTS[dueType];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setResult(null);

    // Mock payment processing
    setTimeout(() => {
      setIsProcessing(false);
      setResult({
        success: true,
        paymentId: `pay_${Date.now()}`,
        amount: total,
      });
    }, 1500);
  };

  if (result?.success) {
    return (
      <div className="rounded-xl border border-wial-success/30 bg-wial-success/5 p-8 text-center">
        <h3 className="text-xl font-bold text-wial-success">Payment Successful</h3>
        <p className="mt-2 text-wial-gray-600">
          Amount: ${result.amount} USD
        </p>
        <p className="text-sm text-wial-gray-500">
          Payment ID: {result.paymentId}
        </p>
        <p className="mt-4 text-sm text-wial-gray-500">
          A receipt has been sent to your email.
        </p>
        <button
          onClick={() => setResult(null)}
          className="mt-4 rounded-lg bg-wial-blue px-4 py-2 text-sm font-medium text-white hover:bg-wial-blue-light"
        >
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

      {/* Due type */}
      <fieldset>
        <legend className="text-sm font-medium text-wial-gray-700">Dues Type</legend>
        <div className="mt-2 space-y-2">
          {(Object.keys(DUE_LABELS) as DueType[]).map((type) => (
            <label key={type} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="dueType"
                value={type}
                checked={dueType === type}
                onChange={() => setDueType(type)}
                className="h-4 w-4 text-wial-blue focus:ring-wial-blue"
              />
              <span className="text-sm text-wial-gray-700">{DUE_LABELS[type]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Quantity */}
      <label className="block">
        <span className="text-sm font-medium text-wial-gray-700">Quantity</span>
        <input
          type="number"
          min={1}
          max={10000}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          className="mt-1 w-full rounded-lg border border-wial-gray-300 px-4 py-2.5 text-sm focus:border-wial-blue focus:outline-none focus:ring-2 focus:ring-wial-blue/20"
        />
      </label>

      {/* Payment method */}
      <fieldset>
        <legend className="text-sm font-medium text-wial-gray-700">Payment Method</legend>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={() => setMethod("stripe")}
            className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
              method === "stripe"
                ? "border-wial-blue bg-wial-blue/5 text-wial-blue"
                : "border-wial-gray-200 text-wial-gray-600 hover:border-wial-gray-300"
            }`}
          >
            Stripe
          </button>
          <button
            type="button"
            onClick={() => setMethod("paypal")}
            className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
              method === "paypal"
                ? "border-wial-blue bg-wial-blue/5 text-wial-blue"
                : "border-wial-gray-200 text-wial-gray-600 hover:border-wial-gray-300"
            }`}
          >
            PayPal
          </button>
        </div>
      </fieldset>

      {/* Total */}
      <div className="rounded-lg bg-wial-gray-50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-wial-gray-600">Total</span>
          <span className="text-2xl font-bold text-wial-gray-900">${total} USD</span>
        </div>
        <p className="mt-1 text-xs text-wial-gray-400">
          {quantity} × ${UNIT_AMOUNTS[dueType]} per {dueType === "student_enrollment" ? "student" : "coach"}
        </p>
      </div>

      <button
        type="submit"
        disabled={isProcessing}
        className="w-full rounded-lg bg-wial-blue px-4 py-3 font-medium text-white transition-colors hover:bg-wial-blue-light disabled:opacity-50"
      >
        {isProcessing ? "Processing..." : `Pay $${total} via ${method === "stripe" ? "Stripe" : "PayPal"}`}
      </button>

      <p className="text-center text-xs text-wial-gray-400">
        Payments are processed securely. Affiliates and instructors pay WIAL Global directly.
      </p>
    </form>
  );
}
