"use client";

/**
 * Template management — view/update parent template.
 * Requirement: 4.1, 4.3
 */

import { RouteGuard } from "../../context/AuthContext";

function TemplatesContent() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-wial-gray-900">Template Management</h1>
      <p className="mt-2 text-wial-gray-600">
        Manage the global parent template. Changes sync to all active chapters.
      </p>

      <div className="mt-8 space-y-6">
        <div className="rounded-xl border border-wial-gray-200 p-6">
          <h2 className="font-semibold text-wial-gray-900">Current Template</h2>
          <p className="mt-1 text-sm text-wial-gray-500">Version 3 · Last updated March 15, 2026</p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-wial-gray-50 p-3">
              <p className="font-medium text-wial-gray-700">Header</p>
              <p className="text-wial-gray-500">Global navigation with WIAL branding</p>
            </div>
            <div className="rounded-lg bg-wial-gray-50 p-3">
              <p className="font-medium text-wial-gray-700">Footer</p>
              <p className="text-wial-gray-500">Contact, links, social, copyright</p>
            </div>
            <div className="rounded-lg bg-wial-gray-50 p-3">
              <p className="font-medium text-wial-gray-700">Navigation</p>
              <p className="text-wial-gray-500">7 main nav items + chapter local nav</p>
            </div>
            <div className="rounded-lg bg-wial-gray-50 p-3">
              <p className="font-medium text-wial-gray-700">Global Styles</p>
              <p className="text-wial-gray-500">WIAL design tokens (colors, typography)</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-wial-gray-200 p-6">
          <h2 className="font-semibold text-wial-gray-900">Sync Status</h2>
          <p className="mt-1 text-sm text-wial-success">All 12 active chapters synced</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminTemplatesPage() {
  return (
    <RouteGuard requiredRole="Super_Admin">
      <TemplatesContent />
    </RouteGuard>
  );
}
