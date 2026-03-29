"use client";

/**
 * Super Admin — manage all chapter leads and coaches worldwide.
 * Filter by country, role, status.
 */

import { useState, useMemo } from "react";
import { RouteGuard } from "../../context/AuthContext";

interface Person {
  id: string;
  name: string;
  email: string;
  role: "Chapter_Lead" | "Coach";
  country: string;
  region: string;
  status: "active" | "pending" | "inactive";
  chapter?: string;
  certification?: string;
}

const MOCK_PEOPLE: Person[] = [
  { id: "1", name: "Maria Santos", email: "maria@example.com", role: "Chapter_Lead", country: "Brazil", region: "South America", status: "active", chapter: "WIAL Brazil" },
  { id: "2", name: "John Davis", email: "john@example.com", role: "Chapter_Lead", country: "USA", region: "North America", status: "active", chapter: "WIAL USA" },
  { id: "3", name: "Yuki Sato", email: "yuki@example.com", role: "Chapter_Lead", country: "Japan", region: "Asia Pacific", status: "pending" },
  { id: "4", name: "Amina Diallo", email: "amina@example.com", role: "Chapter_Lead", country: "Nigeria", region: "Africa", status: "pending" },
  { id: "5", name: "Dr. Sarah Chen", email: "sarah@example.com", role: "Coach", country: "Singapore", region: "Asia Pacific", status: "active", certification: "MALC" },
  { id: "6", name: "Carlos Mendes", email: "carlos@example.com", role: "Coach", country: "Brazil", region: "South America", status: "active", certification: "SALC" },
  { id: "7", name: "Emily Thompson", email: "emily@example.com", role: "Coach", country: "United Kingdom", region: "Europe", status: "active", certification: "PALC" },
  { id: "8", name: "Amara Okafor", email: "amara@example.com", role: "Coach", country: "Nigeria", region: "Africa", status: "active", certification: "CALC" },
  { id: "9", name: "Hans Mueller", email: "hans@example.com", role: "Coach", country: "Germany", region: "Europe", status: "pending", certification: "SALC" },
  { id: "10", name: "Priya Sharma", email: "priya@example.com", role: "Coach", country: "India", region: "Asia Pacific", status: "active", certification: "CALC" },
];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-wial-success/10 text-wial-success",
  pending: "bg-wial-warning/10 text-wial-warning",
  inactive: "bg-wial-gray-100 text-wial-gray-500",
};

function PeopleContent() {
  const [roleFilter, setRoleFilter] = useState<"all" | "Chapter_Lead" | "Coach">("all");
  const [countryFilter, setCountryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending">("all");

  const countries = useMemo(() => Array.from(new Set(MOCK_PEOPLE.map((p) => p.country))).sort(), []);

  let filtered = MOCK_PEOPLE;
  if (roleFilter !== "all") filtered = filtered.filter((p) => p.role === roleFilter);
  if (countryFilter) filtered = filtered.filter((p) => p.country === countryFilter);
  if (statusFilter !== "all") filtered = filtered.filter((p) => p.status === statusFilter);

  const pendingCLs = MOCK_PEOPLE.filter((p) => p.role === "Chapter_Lead" && p.status === "pending");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-wial-gray-900">People Management</h1>
      <p className="mt-1 text-wial-gray-500">Manage all chapter leads and coaches worldwide</p>

      {/* Pending CL approvals */}
      {pendingCLs.length > 0 && (
        <div className="mt-6 rounded-lg border border-wial-warning/30 bg-wial-warning/5 p-5">
          <h2 className="text-sm font-bold text-wial-warning">Pending Chapter Lead Approvals ({pendingCLs.length})</h2>
          <div className="mt-3 space-y-2">
            {pendingCLs.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded bg-white px-4 py-2">
                <div>
                  <p className="text-sm font-semibold text-wial-gray-900">{p.name}</p>
                  <p className="text-xs text-wial-gray-500">{p.email} · {p.country}</p>
                </div>
                <div className="flex gap-2">
                  <button className="rounded bg-wial-success px-3 py-1 text-xs font-semibold text-white">Approve & Create Account</button>
                  <button className="rounded bg-wial-gray-200 px-3 py-1 text-xs font-semibold text-wial-gray-600">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-wial-gray-500">Role:</span>
          {(["all", "Chapter_Lead", "Coach"] as const).map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${roleFilter === r ? "bg-wial-red text-white" : "bg-wial-gray-100 text-wial-gray-600 hover:bg-wial-gray-200"}`}>
              {r === "all" ? "All" : r === "Chapter_Lead" ? "Chapter Leads" : "Coaches"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-wial-gray-500">Country:</span>
          <button onClick={() => setCountryFilter("")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!countryFilter ? "bg-wial-red text-white" : "bg-wial-gray-100 text-wial-gray-600 hover:bg-wial-gray-200"}`}>All</button>
          {countries.map((c) => (
            <button key={c} onClick={() => setCountryFilter(c)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${countryFilter === c ? "bg-wial-red text-white" : "bg-wial-gray-100 text-wial-gray-600 hover:bg-wial-gray-200"}`}>{c}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-wial-gray-500">Status:</span>
          {(["all", "active", "pending"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${statusFilter === s ? "bg-wial-red text-white" : "bg-wial-gray-100 text-wial-gray-600 hover:bg-wial-gray-200"}`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-lg border border-wial-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-wial-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Name</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Role</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Country</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Chapter / Cert</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-wial-gray-100">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-wial-gray-50">
                <td className="px-4 py-3"><p className="font-medium text-wial-gray-900">{p.name}</p><p className="text-xs text-wial-gray-400">{p.email}</p></td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.role === "Chapter_Lead" ? "bg-wial-gold/20 text-wial-gold-dark" : "bg-wial-info/10 text-wial-info"}`}>{p.role === "Chapter_Lead" ? "Chapter Lead" : "Coach"}</span></td>
                <td className="px-4 py-3 text-wial-gray-600">{p.country}</td>
                <td className="px-4 py-3 text-wial-gray-600">{p.chapter ?? p.certification ?? "—"}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[p.status]}`}>{p.status}</span></td>
                <td className="px-4 py-3"><button className="text-xs text-wial-red hover:text-wial-red-light">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-wial-gray-400">Showing {filtered.length} of {MOCK_PEOPLE.length}</p>
    </div>
  );
}

export default function PeoplePage() {
  return (<RouteGuard requiredRole="Super_Admin"><PeopleContent /></RouteGuard>);
}
