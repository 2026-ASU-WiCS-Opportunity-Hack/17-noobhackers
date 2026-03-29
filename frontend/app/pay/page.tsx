"use client";

/**
 * Payment page — accessible to Chapter Leads for dues payment.
 */

import PaymentForm from "../components/PaymentForm";
import { RouteGuard } from "../context/AuthContext";

function PayContent() {
  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
      <h1 className="text-3xl font-bold text-wial-gray-900">Pay Dues</h1>
      <p className="mt-2 text-wial-gray-500">
        Submit dues payment to WIAL Global via Stripe or PayPal.
      </p>
      <div className="mt-8">
        <PaymentForm />
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <RouteGuard requiredRole="Chapter_Lead">
      <PayContent />
    </RouteGuard>
  );
}
