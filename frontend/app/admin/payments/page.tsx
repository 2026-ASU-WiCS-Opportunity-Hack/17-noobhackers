"use client";

/**
 * Super Admin — global payments with filters: due status, country, region, coach, chapter lead.
 */

import { useState, useMemo } from "react";
import { RouteGuard } from "../../context/AuthContext";

interface PaymentRecord {
  id: string;
  payer: string;
  payerRole: "Coach" | "Chapter_Lead";
  chapter: string;
  country: string;
  region: string;
  type: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  date: string;
}

const MOCK: PaymentRecord[] = [
  { id: "1", payer: "WIAL USA (John Davis)", payerRole: "Chapter_Lead", chapter: "USA", country: "USA", region: "North America", type: "Affiliation Fee", amount: 500, status: "paid", date: "2026-03-15" },
  { id: "2", payer: "WIAL Brazil (Maria Santos)", payerRole: "Chapter_Lead", chapter: "Brazil", country: "Brazil", region: "South America", type: "Student Enrollment (10)", amount: 500, status: "paid", date: "2026-03-10" },
  { id: "3", payer: "Dr. Sarah Chen", payerRole: "Coach", chapter: "Singapore", country: "Singapore", region: "Asia Pacific", type: "Certification Fee", amount: 30, status: "paid", date: "2026-03-08" },
  { id: "4", payer: "WIAL UK (Emily T.)", payerRole: "Chapter_Lead", chapter: "UK", country: "United Kingdom", region: "Europe", type: "Affiliation Fee", amount: 500, status: "overdue", date: "2026-01-15" },
  { id: "5", payer: "Carlos Mendes", payerRole: "Coach", chapter: "Brazil", country: "Brazil", region: "South America", type: "Certification Fee", amount: 30, status: "pending", date: "2026-04-01" },
  { id: "6", payer: "Amara Okafor", payerRole: "Coach", chapter: "Nigeria", country: "Nigeria", region: "Africa", type: "Certification Fee", amount: 30, status: "overdue", date: "2026-02-01" },
  { id: "7", payer: "Hans Mueller", payerRole: "Coach", chapter: "Germany", country: "Germany", region: "Europe", type: "Certification Fee", amount: 30, status: "paid", date: "2026-02-20" },
  { id: "8", payer: "WIAL Japan (Kenji T.)", payerRole: "Chapter_Lead", chapter: "Japan", country: "Japan", region: "Asia Pacific", type: "Student Enrollment (5)", amount: 250, status: "pending", date: "2026-04-10" },
];

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-wial-success/10 text-wial-success",
  pending: "bg-wial-warning/10 text-wial-warning",
  overdue: "bg-wial-error/10 text-wial-error",
};

function PaymentsContent() {
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending" | "overdue">("all");
  const [countryFilter, setCountryFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "Coach" | "Chapter_Lead">("all");

  const countries = useMemo(() => Array.from(new Set(MOCK.map((p) => p.country))).sort(), []);
  const regions = useMemo(() => Array.from(new Set(MOCK.map((p) => p.region))).sort(), []);

  let filtered = MOCK;
  if (statusFilter !== "all") filtered = filtered.filter((p) => p.status === statusFilter);
  if (countryFilter) filtered = filtered.filter((p) => p.country === countryFilter);
  if (regionFilter) filtered = filtered.filter((p) => p.region === regionFilter);
  if (roleFilter !== "all") filtered = filtered.filter((p) => p.payerRole === roleFilter);

  const totalRevenue = MOCK.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalDue = MOCK.filter((p) => p.status !== "paid").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-wial-gray-900">Global Payments</h1>
      <p className="mt-1 text-wial-gray-500">Track all payments from chapter leads and coaches</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Total Collected</p>
          <p className="mt-1 text-2xl font-bold text-wial-success">${totalRevenue.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Outstanding</p>
          <p className="mt-1 text-2xl font-bold text-wial-error">${totalDue.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-wial-gray-200 bg-white p-5">
          <p className="text-sm text-wial-gray-500">Total Transactions</p>
          <p className="mt-1 text-2xl font-bold text-wial-gray-900">{MOCK.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-wial-gray-500">Status:</span>
          {(["all", "paid", "pending", "overdue"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${statusFilter === s ? "bg-wial-red text-white" : "bg-wial-gray-100 text-wial-gray-600 hover:bg-wial-gray-200"}`}>{s}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-wial-gray-500">Payer:</span>
          {(["all", "Chapter_Lead", "Coach"] as const).map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${roleFilter === r ? "bg-wial-red text-white" : "bg-wial-gray-100 text-wial-gray-600 hover:bg-wial-gray-200"}`}>
              {r === "all" ? "All" : r === "Chapter_Lead" ? "Chapter Leads" : "Coaches"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-wial-gray-500">Country:</span>
          <button onClick={() => setCountryFilter("")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!countryFilter ? "bg-wial-red text-white" : "bg-wial-gray-100 text-wial-gray-600 hover:bg-wial-gray-200"}`}>All</button>
          {countries.map((c) => (
            <button key={c} onClick={() => setCountryFilter(c)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${countryFilter === c ? "bg-wial-red text-white" : "bg-wial-gray-100 text-wial-gray-600 hover:bg-wial-gray-200"}`}>{c}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-wial-gray-500">Region:</span>
          <button onClick={() => setRegionFilter("")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!regionFilter ? "bg-wial-red text-white" : "bg-wial-gray-100 text-wial-gray-600 hover:bg-wial-gray-200"}`}>All</button>
          {regions.map((r) => (
            <button key={r} onClick={() => setRegionFilter(r)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${regionFilter === r ? "bg-wial-red text-white" : "bg-wial-gray-100 text-wial-gray-600 hover:bg-wial-gray-200"}`}>{r}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-lg border border-wial-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-wial-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Payer</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Type</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Country</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Amount</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-wial-gray-100">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-wial-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-wial-gray-900">{p.payer}</p>
                  <span className={`text-[10px] font-semibold ${p.payerRole === "Chapter_Lead" ? "text-wial-gold-dark" : "text-wial-info"}`}>
                    {p.payerRole === "Chapter_Lead" ? "Chapter Lead" : "Coach"}
                  </span>
                </td>
                <td className="px-4 py-3 text-wial-gray-600">{p.type}</td>
                <td className="px-4 py-3 text-wial-gray-600">{p.country}</td>
                <td className="px-4 py-3 font-medium text-wial-gray-900">${p.amount}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[p.status]}`}>{p.status}</span></td>
                <td className="px-4 py-3 text-wial-gray-500">{p.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-wial-gray-400">Showing {filtered.length} of {MOCK.length}</p>
    </div>
  );
}

export default function AdminPaymentsPage() {
  return (<RouteGuard requiredRole="Super_Admin"><PaymentsContent /></RouteGuard>);
}
