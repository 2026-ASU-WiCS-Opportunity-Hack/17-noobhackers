/**
 * Coach directory card — displays name, photo, certification badge,
 * location, contact, and bio.
 *
 * Requirements: 6.3, 6.7, 6.9, 6.10
 */

import type { CertificationLevel } from "../config/designTokens";
import CertBadge from "./CertBadge";

export interface CoachProfile {
  coachId: string;
  name: string;
  photoUrl?: string;
  certificationLevel: CertificationLevel;
  location: string;
  country: string;
  contactInfo: string;
  bio: string;
}

interface CoachCardProps {
  coach: CoachProfile;
}

export default function CoachCard({ coach }: CoachCardProps) {
  return (
    <article className="rounded-xl border border-wial-gray-200 p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        {/* Photo — lazy-loaded below the fold per Req 6.10 */}
        {coach.photoUrl ? (
          <img
            src={coach.photoUrl}
            alt={`Photo of ${coach.name}`}
            loading="lazy"
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full bg-wial-gray-100 text-xl font-bold text-wial-blue"
            aria-hidden="true"
          >
            {coach.name.charAt(0)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-wial-gray-900 truncate">
              {coach.name}
            </h3>
            <CertBadge level={coach.certificationLevel} />
          </div>
          <p className="text-sm text-wial-gray-500">{coach.location}</p>
          <p className="text-xs text-wial-gray-400">{coach.country}</p>
          <p className="text-sm text-wial-gray-500">{coach.contactInfo}</p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-wial-gray-700 line-clamp-3">
        {coach.bio}
      </p>
    </article>
  );
}
