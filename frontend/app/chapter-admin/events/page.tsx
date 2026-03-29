"use client";

/**
 * Chapter Lead — create and manage training events for local coaches.
 */

import { useState } from "react";
import { RouteGuard } from "../../context/AuthContext";

const MOCK_EVENTS = [
  { id: "1", title: "CALC Training Workshop", date: "2026-04-20", location: "Chapter HQ", attendees: 12, status: "upcoming" },
  { id: "2", title: "Monthly Coach Meetup", date: "2026-03-15", location: "Virtual", attendees: 8, status: "completed" },
];

function EventsContent() {
  const [events] = useState(MOCK_EVENTS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", location: "", description: "" });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setShowForm(false);
    setForm({ title: "", date: "", location: "", description: "" });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-wial-gray-900">Events</h1>
          <p className="mt-1 text-wial-gray-500">Create and manage training events</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-wial-red px-4 py-2 text-sm font-medium text-white hover:bg-wial-red-light">
          {showForm ? "Cancel" : "+ Create Event"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-6 rounded-lg border border-wial-gray-200 bg-white p-6 space-y-4">
          <h2 className="font-bold text-wial-gray-900">New Training Event</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-wial-gray-700">Event Title</span>
              <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-wial-gray-700">Date</span>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-wial-gray-700">Location</span>
              <input type="text" required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none" />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-wial-gray-700">Description</span>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
              className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-3 text-sm focus:border-wial-red focus:outline-none" />
          </label>
          <button type="submit" className="rounded-lg bg-wial-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-wial-red-light">
            Create Event
          </button>
        </form>
      )}

      <div className="mt-8 space-y-3">
        {events.map((evt) => (
          <div key={evt.id} className="flex flex-col justify-between gap-2 rounded-lg border border-wial-gray-200 px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-sm font-bold text-wial-gray-900">{evt.title}</h3>
              <p className="text-xs text-wial-gray-500">{evt.date} · {evt.location} · {evt.attendees} attendees</p>
            </div>
            <span className={`inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${evt.status === "upcoming" ? "bg-wial-info/10 text-wial-info" : "bg-wial-success/10 text-wial-success"}`}>
              {evt.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChapterEventsPage() {
  return (
    <RouteGuard requiredRole="Chapter_Lead">
      <EventsContent />
    </RouteGuard>
  );
}
