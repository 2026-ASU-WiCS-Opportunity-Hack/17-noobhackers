/**
 * Certification level badge — renders CALC/PALC/SALC/MALC badge
 * with the appropriate color from the design token system.
 *
 * Requirements: 6.7
 */

import type { CertificationLevel } from "../config/designTokens";
import { certLabels } from "../config/designTokens";

interface CertBadgeProps {
  level: CertificationLevel;
  size?: "sm" | "md";
}

const COLOR_MAP: Record<CertificationLevel, string> = {
  CALC: "bg-cert-calc",
  PALC: "bg-cert-palc",
  SALC: "bg-cert-salc",
  MALC: "bg-cert-malc",
};

export default function CertBadge({ level, size = "sm" }: CertBadgeProps) {
  const sizeClasses =
    size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-block rounded-full font-bold text-white ${COLOR_MAP[level]} ${sizeClasses}`}
      title={certLabels[level]}
      aria-label={certLabels[level]}
    >
      {level}
    </span>
  );
}
