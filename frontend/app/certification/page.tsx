/**
 * Certification levels page — CALC, PALC, SALC, MALC descriptions.
 * Requirement: 7.1
 */

import { certLabels } from "../config/designTokens";

const LEVELS = [
  {
    code: "CALC" as const,
    color: "bg-cert-calc",
    description:
      "The entry-level certification for practitioners new to Action Learning. CALC coaches demonstrate foundational competency in facilitating Action Learning sessions and guiding teams through the questioning process.",
    requirements: [
      "Complete WIAL-approved training program",
      "Facilitate a minimum of 3 supervised sessions",
      "Pass the CALC assessment",
    ],
  },
  {
    code: "PALC" as const,
    color: "bg-cert-palc",
    description:
      "The professional-level certification for experienced coaches. PALC coaches show advanced facilitation skills and the ability to handle complex group dynamics.",
    requirements: [
      "Hold active CALC certification",
      "Minimum 2 years of coaching experience",
      "Facilitate 20+ documented sessions",
      "Submit a professional portfolio",
    ],
  },
  {
    code: "SALC" as const,
    color: "bg-cert-salc",
    description:
      "Senior-level recognition for coaches who have demonstrated sustained excellence and mentorship capabilities in Action Learning practice.",
    requirements: [
      "Hold active PALC certification",
      "Minimum 5 years of coaching experience",
      "Mentor at least 3 CALC candidates",
      "Contribute to WIAL knowledge base",
    ],
  },
  {
    code: "MALC" as const,
    color: "bg-cert-malc",
    description:
      "The highest distinction in Action Learning coaching. MALC coaches are recognized thought leaders who advance the field through research, innovation, and global impact.",
    requirements: [
      "Hold active SALC certification",
      "Minimum 10 years of coaching experience",
      "Published research or significant contributions",
      "Demonstrated global impact",
    ],
  },
];

export default function CertificationPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
      <h1 className="text-center text-4xl font-bold text-wial-gray-900">
        Certification Levels
      </h1>
      <p className="mt-4 text-center text-lg text-wial-gray-600">
        Four progressive levels of Action Learning Coach certification
      </p>

      <div className="mt-12 space-y-8">
        {LEVELS.map((level) => (
          <div
            key={level.code}
            className="rounded-xl border border-wial-gray-200 p-6 sm:p-8"
          >
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full ${level.color} px-4 py-1.5 text-sm font-bold text-white`}
              >
                {level.code}
              </span>
              <h2 className="text-xl font-bold text-wial-gray-900">
                {certLabels[level.code]}
              </h2>
            </div>
            <p className="mt-4 text-wial-gray-700">{level.description}</p>
            <div className="mt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-wial-gray-500">
                Requirements
              </h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-wial-gray-600">
                {level.requirements.map((req) => (
                  <li key={req}>{req}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
