"use client";

/**
 * Super Admin — user management with real Cognito user creation.
 * Create Chapter Leads for specific countries.
 */

import { useState, useEffect, useCallback } from "react";
import { RouteGuard, useAuth } from "../../context/AuthContext";

interface UserRecord {
  cognitoUserId: string;
  email: string;
  role: string;
  assignedChapters: string[];
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/";

const ROLE_OPTIONS = [
  { value: "Chapter_Lead", label: "Chapter Lead" },
  { value: "Content_Creator", label: "Content Creator" },
  { value: "Coach", label: "Coach" },
];

function UsersContent() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", role: "Chapter_Lead", country: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchUsers = useCallback(async () => {
    if (!user?.idToken) return;
    try {
      const res = await fetch(`${API_URL}users`, {
        headers: { Authorization: `Bearer ${user.idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
      }
    } catch {} finally { setLoading(false); }
  }, [user?.idToken]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true); setError(""); setSuccess("");

    if (!form.email || !form.role || !form.password) {
      setError("Email, role, and password are required."); setCreating(false); return;
    }

    try {
      const res = await fetch(`${API_URL}users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.idToken}` },
        body: JSON.stringify({
          email: form.email,
          role: form.role,
          password: form.password,
          assignedChapters: form.country ? [form.country.toLowerCase().replace(/\s+/g, "-")] : [],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`User ${form.email} created as ${form.role}. They can now log in.`);
        setForm({ email: "", role: "Chapter_Lead", country: "", password: "" });
        setShowForm(false);
        await fetchUsers();
      } else {
        setError(data.error?.message ?? "Failed to create user.");
      }
    } catch {
      setError("Unable to reach the server.");
    } finally { setCreating(false); }
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-wial-gray-200 border-t-wial-red" /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-wial-gray-900">User Management</h1>
          <p className="mt-1 text-wial-gray-500">Create and manage platform users</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-wial-red px-4 py-2 text-sm font-semibold text-white hover:bg-wial-red-light">
          {showForm ? "Cancel" : "+ Create User"}
        </button>
      </div>

      {success && <div className="mt-4 rounded-lg border border-wial-success/30 bg-wial-success/5 p-4"><p className="text-sm text-wial-success">{success}</p></div>}
      {error && <div className="mt-4 rounded-lg border border-wial-error/30 bg-wial-error/5 p-4"><p className="text-sm text-wial-error">{error}</p></div>}

      {/* Create user form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mt-6 rounded-lg border border-wial-gray-200 bg-white p-6 space-y-4">
          <h2 className="font-bold text-wial-gray-900">Create New User</h2>
          <p className="text-sm text-wial-gray-500">The user will receive login credentials and can sign in immediately.</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-wial-gray-700">Email *</span>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="lead-kenya@wial.org"
                className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-wial-gray-700">Role *</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none">
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-wial-gray-700">Password *</span>
            <input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min 8 characters"
              className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" />
            <p className="mt-1 text-xs text-wial-gray-400">The user will log in with this password. Share it securely.</p>
          </label>

          {form.role === "Chapter_Lead" && (
            <label className="block">
              <span className="text-sm font-medium text-wial-gray-700">Country (one chapter per country) *</span>
              <input type="text" required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="e.g. Kenya"
                className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" />
              <p className="mt-1 text-xs text-wial-gray-400">This Chapter Lead will manage the WIAL chapter for this country.</p>
            </label>
          )}

          <button type="submit" disabled={creating}
            className="rounded-lg bg-wial-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-wial-red-light disabled:opacity-60">
            {creating ? "Creating..." : "Create User"}
          </button>
        </form>
      )}

      {/* Users table */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-wial-gray-900">All Users ({users.length})</h2>
        {users.length === 0 ? (
          <p className="mt-4 text-sm text-wial-gray-400">No users found in the database. Users are synced after their first login.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-wial-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-wial-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Email</th>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Role</th>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Assigned Chapters</th>
                  <th className="px-4 py-3 font-medium text-wial-gray-600">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wial-gray-100">
                {users.map((u) => (
                  <tr key={u.cognitoUserId} className="hover:bg-wial-gray-50">
                    <td className="px-4 py-3 text-wial-gray-900">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        u.role === "Super_Admin" ? "bg-wial-red/10 text-wial-red" :
                        u.role === "Chapter_Lead" ? "bg-wial-gold/20 text-wial-gold-dark" :
                        "bg-wial-info/10 text-wial-info"
                      }`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-wial-gray-600">{u.assignedChapters?.join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-xs text-wial-gray-500">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  return (<RouteGuard requiredRole="Super_Admin"><UsersContent /></RouteGuard>);
}
