"use client";

/**
 * Coach onboarding request — sends request to Chapter Lead.
 * Public page where prospective coaches can request to join.
 */

import { useState } from "react";
import Link from "next/link";

export default function OnboardPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    location: "",
    region: "",
    bio: "",
    certificationLevel: "CALC",
    chapterPreference: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production: POST to /coaches/request endpoint which emails the CL
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-xl border border-wial-success/30 bg-wial-success/5 p-8">
          <h2 className="text-2xl font-bold text-wial-success">Request Submitted</h2>
          <p className="mt-3 text-wial-gray-600">
            Your onboarding request has been sent to the Chapter Lead for review.
            You will receive an email once your account is approved.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm font-semibold text-wial-red hover:text-wial-red-light">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <h1 className="text-3xl font-bold text-wial-gray-900">Become a WIAL Coach</h1>
      <p className="mt-2 text-wial-gray-600">
        Submit your details to request onboarding. A Chapter Lead will review
        your application and set up your account.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Full Name <span className="text-wial-error">*</span></span>
          <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none focus:ring-2 focus:ring-wial-red/20" />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Email <span className="text-wial-error">*</span></span>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none focus:ring-2 focus:ring-wial-red/20" />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Location (City, Country) <span className="text-wial-error">*</span></span>
          <input type="text" required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="e.g. São Paulo, Brazil"
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none focus:ring-2 focus:ring-wial-red/20" />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Region <span className="text-wial-error">*</span></span>
          <select required value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none focus:ring-2 focus:ring-wial-red/20">
            <option value="">Select region</option>
            <option value="North America">North America</option>
            <option value="South America">South America</option>
            <option value="Europe">Europe</option>
            <option value="Asia Pacific">Asia Pacific</option>
            <option value="Africa">Africa</option>
            <option value="Oceania">Oceania</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Preferred Chapter</span>
          <select value={form.chapterPreference} onChange={(e) => setForm({ ...form, chapterPreference: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none focus:ring-2 focus:ring-wial-red/20">
            <option value="">Select chapter (optional)</option>
            <option value="usa">USA</option>
            <option value="brazil">Brazil</option>
            <option value="uk">United Kingdom</option>
            <option value="singapore">Singapore</option>
            <option value="south-africa">South Africa</option>
            <option value="australia">Australia</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Certification Level</span>
          <select value={form.certificationLevel} onChange={(e) => setForm({ ...form, certificationLevel: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none focus:ring-2 focus:ring-wial-red/20">
            <option value="CALC">CALC — Certified Action Learning Coach</option>
            <option value="PALC">PALC — Professional Action Learning Coach</option>
            <option value="SALC">SALC — Senior Action Learning Coach</option>
            <option value="MALC">MALC — Master Action Learning Coach</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Bio / Experience <span className="text-wial-error">*</span></span>
          <textarea required value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={4}
            placeholder="Tell us about your Action Learning experience..."
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-3 text-sm focus:border-wial-red focus:outline-none focus:ring-2 focus:ring-wial-red/20" />
        </label>

        <button type="submit"
          className="w-full rounded-lg bg-wial-red px-4 py-3 text-sm font-semibold text-white hover:bg-wial-red-light">
          Submit Onboarding Request
        </button>
      </form>
    </div>
  );
}
