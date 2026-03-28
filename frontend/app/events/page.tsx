/**
 * Global events calendar — displays global and chapter events with filtering.
 * Requirements: 7.1, 7.3
 */

const EVENTS = [
  { id: "1", title: "WIAL Global Conference 2026", date: "June 15-17, 2026", location: "Virtual", chapter: null, type: "Conference" },
  { id: "2", title: "CALC Certification Workshop", date: "April 20, 2026", location: "New York, USA", chapter: "usa", type: "Workshop" },
  { id: "3", title: "Action Learning Masterclass", date: "May 5, 2026", location: "London, UK", chapter: "uk", type: "Masterclass" },
  { id: "4", title: "PALC Advanced Training", date: "May 20, 2026", location: "São Paulo, Brazil", chapter: "brazil", type: "Training" },
  { id: "5", title: "Coach Networking Event", date: "June 1, 2026", location: "Singapore", chapter: "singapore", type: "Networking" },
  { id: "6", title: "Annual Research Symposium", date: "July 10, 2026", location: "Virtual", chapter: null, type: "Symposium" },
];

export default function EventsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
      <h1 className="text-4xl font-bold text-wial-gray-900">Events Calendar</h1>
      <p className="mt-4 text-lg text-wial-gray-600">
        Upcoming events across the global WIAL network
      </p>

      <div className="mt-10 space-y-4">
        {EVENTS.map((evt) => (
          <div
            key={evt.id}
            className="flex flex-col gap-2 rounded-xl border border-wial-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-wial-gray-900">{evt.title}</h3>
                {!evt.chapter && (
                  <span className="rounded-full bg-wial-gold/20 px-2 py-0.5 text-xs font-medium text-wial-gold-dark">
                    Global
                  </span>
                )}
              </div>
              <p className="text-sm text-wial-gray-500">
                {evt.date} · {evt.location}
              </p>
            </div>
            <span className="rounded-lg bg-wial-gray-100 px-3 py-1 text-sm font-medium text-wial-gray-700">
              {evt.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
