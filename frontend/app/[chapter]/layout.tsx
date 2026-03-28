/**
 * Chapter layout — inherits global template (locked header/footer from
 * root layout), adds chapter-specific local navigation.
 *
 * Requirements: 4.1, 4.2, 4.4
 */

import Link from "next/link";

const LOCAL_NAV = [
  { path: "", label: "Home" },
  { path: "/coaches", label: "Coaches" },
  { path: "/events", label: "Events" },
  { path: "/team", label: "Team" },
  { path: "/resources", label: "Resources" },
  { path: "/contact", label: "Contact" },
];

export default async function ChapterLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ chapter: string }>;
}) {
  const { chapter } = await params;
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex flex-col">
      {/* Chapter local nav */}
      <nav
        className="border-b border-wial-gray-200 bg-wial-gray-50"
        aria-label="Chapter navigation"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
          <span className="shrink-0 text-sm font-semibold text-wial-blue">
            {chapterName}
          </span>
          <ul className="flex items-center gap-1" role="list">
            {LOCAL_NAV.map((item) => (
              <li key={item.path}>
                <Link
                  href={`/${chapter}${item.path}`}
                  className="rounded-md px-3 py-1.5 text-sm text-wial-gray-600 transition-colors hover:bg-wial-gray-200 hover:text-wial-gray-900"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {children}
    </div>
  );
}
