/**
 * Chapter leadership/team page.
 * Requirement: 7.2
 */

export default async function ChapterTeamPage({
  params,
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { chapter } = await params;
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const team = [
    { name: "Executive Director", role: "Chapter Lead", initials: "ED" },
    { name: "Program Coordinator", role: "Content Creator", initials: "PC" },
    { name: "Training Director", role: "Senior Coach", initials: "TD" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-wial-gray-900">
        {chapterName} Team
      </h1>
      <p className="mt-2 text-wial-gray-600">
        Chapter leadership and team members
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {team.map((member) => (
          <div
            key={member.name}
            className="rounded-xl border border-wial-gray-200 p-6 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-wial-blue/10 text-xl font-bold text-wial-blue">
              {member.initials}
            </div>
            <h3 className="mt-3 font-semibold text-wial-gray-900">
              {member.name}
            </h3>
            <p className="text-sm text-wial-gray-500">{member.role}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
