"use client";

/**
 * Coach self-service profile editor.
 * Shows pending approval status when update is submitted.
 *
 * Requirements: 6.6, 6.8
 */

import { useState } from "react";
import { RouteGuard } from "../context/AuthContext";

function ProfileContent() {
  const [form, setForm] = useState({
    name: "Dr. Sarah Chen",
    location: "Singapore",
    contactInfo: "coach@example.com",
    bio: "Master Action Learning Coach with 15 years of experience.",
  });
  const [status, setStatus] = useState<"idle" | "pending" | "saved">("idle");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("pending");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold text-wial-gray-900">My Profile</h1>
      <p className="mt-2 text-wial-gray-600">
        Update your coach profile. Changes require approval.
      </p>

      {status === "pending" && (
        <div className="mt-4 rounded-lg border border-wial-warning/30 bg-wial-warning/5 p-4">
          <p className="text-sm font-medium text-wial-warning">
            Your profile update is pending approval by the Executive Director.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Name</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-300 px-4 py-2.5 text-sm focus:border-wial-blue focus:outline-none focus:ring-2 focus:ring-wial-blue/20"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Location</span>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-300 px-4 py-2.5 text-sm focus:border-wial-blue focus:outline-none focus:ring-2 focus:ring-wial-blue/20"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Contact Info</span>
          <input
            type="text"
            value={form.contactInfo}
            onChange={(e) => setForm({ ...form, contactInfo: e.target.value })}
            className="mt-1 w-full rounded-lg border border-wial-gray-300 px-4 py-2.5 text-sm focus:border-wial-blue focus:outline-none focus:ring-2 focus:ring-wial-blue/20"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Bio</span>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={5}
            className="mt-1 w-full rounded-lg border border-wial-gray-300 px-4 py-3 text-sm focus:border-wial-blue focus:outline-none focus:ring-2 focus:ring-wial-blue/20"
          />
        </label>

        <button
          type="submit"
          disabled={status === "pending"}
          className="w-full rounded-lg bg-wial-blue px-4 py-3 font-medium text-white hover:bg-wial-blue-light disabled:opacity-50"
        >
          {status === "pending" ? "Update Pending Approval" : "Submit Update"}
        </button>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RouteGuard requiredRole="Coach">
      <ProfileContent />
    </RouteGuard>
  );
}
