"use client";

/**
 * User/role management — list, create, change role, deactivate.
 * Requirement: 3.2
 */

import { RouteGuard } from "../../context/AuthContext";

const MOCK_USERS = [
  { id: "u1", email: "admin@wial.org", role: "Super_Admin", status: "active" },
  { id: "u2", email: "lead-usa@wial.org", role: "Chapter_Lead", status: "active" },
  { id: "u3", email: "editor@wial.org", role: "Content_Creator", status: "active" },
  { id: "u4", email: "coach1@wial.org", role: "Coach", status: "active" },
  { id: "u5", email: "coach2@wial.org", role: "Coach", status: "inactive" },
];

function UsersContent() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-wial-gray-900">Users</h1>
        <button className="rounded-lg bg-wial-blue px-4 py-2 text-sm font-medium text-white hover:bg-wial-blue-light">
          + Add User
        </button>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-wial-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-wial-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Email</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Role</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-wial-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-wial-gray-100">
            {MOCK_USERS.map((u) => (
              <tr key={u.id} className="hover:bg-wial-gray-50">
                <td className="px-4 py-3 text-wial-gray-900">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-wial-blue/10 px-2 py-0.5 text-xs font-medium text-wial-blue">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.status === "active"
                      ? "bg-wial-success/10 text-wial-success"
                      : "bg-wial-gray-100 text-wial-gray-500"
                  }`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button className="text-xs text-wial-blue hover:text-wial-blue-light">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <RouteGuard requiredRole="Super_Admin">
      <UsersContent />
    </RouteGuard>
  );
}
