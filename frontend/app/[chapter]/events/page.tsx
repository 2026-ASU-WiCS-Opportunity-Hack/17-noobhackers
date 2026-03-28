/**
 * Chapter events + global events visible to all chapters.
 * Requirements: 7.3, 7.4
 */

export default async function ChapterEventsPage({
  params,
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { chapter } = await params;
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const events = [
    { id: "g1", title: "WIAL Global Conference 2026", date: "June 15-17, 2026", location: "Virtual", isGlobal: true },
    { id: "l1", title: `${chapterName} Quarterly Meeting`, date: "April 10, 2026", location: chapterName, isGlobal: false },
    { id: "l2", title: `${chapterName} Coach Workshop`, date: "May 15, 2026", location: chapterName, isGlobal: false },
    { id: "g2", title: "Annual Research Symposium", date: "July 10, 2026", location: "Virtual", isGlobal: true },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-wial-gray-900">
        {chapterName} Events
      </h1>
      <p className="mt-2 text-wial-gray-600">
        Chapter and global events
      </p>

      <div className="mt-8 space-y-4">
        {events.map((evt) => (
          <div
            key={evt.id}
            className="flex items-center justify-between rounded-xl border border-wial-gray-200 p-5"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-wial-gray-900">{evt.title}</h3>
                {evt.isGlobal && (
                  <span className="rounded-full bg-wial-gold/20 px-2 py-0.5 text-xs font-medium text-wial-gold-dark">
                    Global
                  </span>
                )}
              </div>
              <p className="text-sm text-wial-gray-500">
                {evt.date} · {evt.location}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
