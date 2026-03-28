/**
 * Chapter-specific resources page.
 * Requirement: 7.2
 */

export default async function ChapterResourcesPage({
  params,
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { chapter } = await params;
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const resources = [
    { title: "Local Training Materials", description: "Region-specific guides and handouts" },
    { title: "Chapter Newsletter Archive", description: "Past newsletters and updates" },
    { title: "Event Recordings", description: "Recordings from chapter workshops and events" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-wial-gray-900">
        {chapterName} Resources
      </h1>
      <p className="mt-2 text-wial-gray-600">
        Resources specific to the {chapterName} chapter
      </p>

      <div className="mt-8 space-y-4">
        {resources.map((res) => (
          <div
            key={res.title}
            className="rounded-xl border border-wial-gray-200 p-5 transition-shadow hover:shadow-md"
          >
            <h3 className="font-semibold text-wial-gray-900">{res.title}</h3>
            <p className="mt-1 text-sm text-wial-gray-600">{res.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
