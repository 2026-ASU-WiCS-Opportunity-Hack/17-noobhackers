/**
 * Chapter contact page with Executive Director email.
 * Requirement: 7.2
 */

export default async function ChapterContactPage({
  params,
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { chapter } = await params;
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-wial-gray-900">
        Contact {chapterName}
      </h1>
      <p className="mt-4 text-wial-gray-600">
        Get in touch with the WIAL {chapterName} chapter team.
      </p>

      <div className="mt-8 rounded-xl border border-wial-gray-200 p-8">
        <h2 className="text-xl font-bold text-wial-gray-900">
          Executive Director
        </h2>
        <p className="mt-2 text-wial-gray-600">
          For chapter inquiries, partnerships, and local certification:
        </p>
        <a
          href={`mailto:${chapter}@wial.org`}
          className="mt-4 inline-block text-lg font-medium text-wial-blue hover:text-wial-blue-light"
        >
          {chapter}@wial.org
        </a>
      </div>
    </div>
  );
}
