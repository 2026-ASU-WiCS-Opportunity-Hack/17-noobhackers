/**
 * Chapter landing page — editable hero section and about content.
 *
 * Requirements: 4.1, 4.2, 4.4
 */

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { chapter } = await params;
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex flex-col">
      {/* Hero — editable by Chapter_Lead */}
      <section className="bg-wial-blue px-4 py-16 text-center text-white sm:py-20">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            WIAL {chapterName}
          </h1>
          <p className="mt-4 text-lg text-wial-gold-light">
            Action Learning in {chapterName}
          </p>
        </div>
      </section>

      {/* About — editable content area */}
      <section className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <h2 className="text-2xl font-bold text-wial-gray-900">
          About WIAL {chapterName}
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-wial-gray-700">
          Welcome to the WIAL {chapterName} chapter. We are dedicated to
          advancing Action Learning practice in our region, certifying coaches,
          and supporting organizations in their leadership development journey.
        </p>
        <p className="mt-4 text-wial-gray-600">
          Our chapter connects local practitioners with the global WIAL network,
          providing training, events, and resources tailored to our community.
        </p>
      </section>
    </div>
  );
}
