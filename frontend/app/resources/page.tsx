/**
 * Resources & Library page — categorized links to WIAL publications.
 * Requirement: 7.1, 7.5
 */

const CATEGORIES = [
  {
    title: "Publications",
    items: [
      { name: "Action Learning Handbook", description: "Comprehensive guide to the WIAL methodology" },
      { name: "Research Journal", description: "Peer-reviewed articles on Action Learning" },
      { name: "Case Studies Collection", description: "Real-world applications across industries" },
    ],
  },
  {
    title: "Guides & Toolkits",
    items: [
      { name: "Facilitator's Quick Start Guide", description: "Essential tips for new coaches" },
      { name: "Session Planning Toolkit", description: "Templates and checklists for sessions" },
      { name: "Assessment Rubrics", description: "Evaluation criteria for certification" },
    ],
  },
  {
    title: "Learning Materials",
    items: [
      { name: "Video Library", description: "Recorded sessions and masterclasses" },
      { name: "Webinar Archive", description: "Past webinars on Action Learning topics" },
      { name: "Podcast Series", description: "Conversations with leading practitioners" },
    ],
  },
];

export default function ResourcesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
      <h1 className="text-4xl font-bold text-wial-gray-900">
        Resources & Library
      </h1>
      <p className="mt-4 text-lg text-wial-gray-600">
        Access publications, guides, and learning materials for Action Learning
        practitioners.
      </p>

      <div className="mt-12 space-y-10">
        {CATEGORIES.map((cat) => (
          <div key={cat.title}>
            <h2 className="text-2xl font-bold text-wial-gray-900">
              {cat.title}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {cat.items.map((item) => (
                <div
                  key={item.name}
                  className="rounded-xl border border-wial-gray-200 p-5 transition-shadow hover:shadow-md"
                >
                  <h3 className="font-semibold text-wial-gray-900">
                    {item.name}
                  </h3>
                  <p className="mt-1 text-sm text-wial-gray-600">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
