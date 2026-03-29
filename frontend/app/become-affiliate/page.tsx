"use client";

/**
 * Chapter Lead onboarding — request to become a WIAL affiliate.
 * Sends request to Super Admin who approves and shares login creds.
 */

import { useState } from "react";
import Link from "next/link";

export default function BecomeAffiliatePage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", organization: "", country: "", region: "", reason: "",
  });

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-xl border border-wial-success/30 bg-wial-success/5 p-8">
          <h2 className="text-2xl font-bold text-wial-success">Request Submitted</h2>
          <p className="mt-3 text-wial-gray-600">
            Your affiliate request has been sent to the WIAL Global Admin.
            You will receive login credentials via email once approved.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm font-semibold text-wial-red">← Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <h1 className="text-3xl font-bold text-wial-gray-900">Become a WIAL Affiliate</h1>
      <p className="mt-2 text-wial-gray-500">
        Apply to become a Chapter Lead and establish a WIAL chapter in your country.
        The Super Admin will review your application and share login credentials.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Full Name *</span>
          <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Email *</span>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Organization *</span>
          <input type="text" required value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Country *</span>
          <input type="text" required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Region *</span>
          <select required value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none">
            <option value="">Select region</option>
            <option>North America</option><option>South America</option><option>Europe</option>
            <option>Asia Pacific</option><option>Africa</option><option>Oceania</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Why do you want to become an affiliate? *</span>
          <textarea required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={4}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-3 text-sm focus:border-wial-red focus:outline-none" />
        </label>
        <button type="submit" className="w-full rounded-lg bg-wial-red px-4 py-3 text-sm font-semibold text-white hover:bg-wial-red-light">
          Submit Affiliate Request
        </button>
      </form>
    </div>
  );
}
